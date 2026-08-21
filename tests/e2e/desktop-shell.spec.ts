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
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";
import { _electron as electron } from "playwright";

import { parseManuscriptInputProfile } from "../../src/application/editor/manuscript-input-profile";
import { getPreviousEpisodeFlowPreviewText } from "../../src/application/editor/previous-episode-flow";
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

async function openPublishingFromLibrary(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "작품 도구 열기", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "투고 운영", exact: true })
    .click();
}

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
  await continueFromMain(page);
  await expect(
    page.getByRole("textbox", { name: "원고" }),
  ).toBeVisible();
  return page;
}

async function installFakeYouTubePlayer(targetPage: Page): Promise<void> {
  await targetPage.evaluate(() => {
    const testWindow = window as unknown as {
      YT?: unknown;
      __youtubePlayerCalls?: string[];
    };
    const calls: string[] = [];
    testWindow.__youtubePlayerCalls = calls;
    testWindow.YT = {
      Player: class {
        readonly events: {
          readonly onReady: () => void;
          readonly onStateChange: (event: { readonly data: number }) => void;
        };

        constructor(
          _element: HTMLElement,
          options: {
            readonly events: {
              readonly onReady: () => void;
              readonly onStateChange: (event: { readonly data: number }) => void;
            };
          },
        ) {
          this.events = options.events;
          window.setTimeout(() => this.events.onReady(), 0);
        }

        destroy() {
          calls.push("destroy");
        }

        loadVideoById(videoId: string) {
          calls.push(`load:${videoId}`);
          this.events.onStateChange({ data: 1 });
        }

        pauseVideo() {
          calls.push("pause");
          this.events.onStateChange({ data: 2 });
        }

        playVideo() {
          calls.push("play");
          this.events.onStateChange({ data: 1 });
        }

        setVolume(volume: number) {
          calls.push(`volume:${volume}`);
        }

        stopVideo() {
          calls.push("stop");
        }
      },
    };
  });
}

async function installFakePomodoroAlertAudio(targetPage: Page): Promise<void> {
  await targetPage.evaluate(() => {
    const testWindow = window as unknown as {
      AudioContext: unknown;
      __pomodoroAlertSoundCount?: number;
    };
    testWindow.__pomodoroAlertSoundCount = 0;

    class FakeAudioParam {
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }

    class FakeOscillator {
      frequency = new FakeAudioParam();
      onended: (() => void) | null = null;
      type = "sine";
      connect() {}
      disconnect() {}
      start() {
        testWindow.__pomodoroAlertSoundCount =
          (testWindow.__pomodoroAlertSoundCount ?? 0) + 1;
      }
      stop() {
        this.onended?.();
      }
    }

    class FakeGain {
      gain = new FakeAudioParam();
      connect() {}
      disconnect() {}
    }

    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      state = "running";
      createGain() {
        return new FakeGain();
      }
      createOscillator() {
        return new FakeOscillator();
      }
      resume() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(testWindow, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
  });
}

async function continueFromMain(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /이어쓰기$/u })
    .first()
    .click();
}

async function openStudioHome(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "홈 열기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "홈", exact: true }),
  ).toBeVisible();
}

async function openReviewRail(page: Page): Promise<void> {
  const reviewRail = page.getByRole("complementary", { name: "검토 레일" });
  if (!(await reviewRail.isVisible())) {
    await page
      .getByRole("button", { name: "검토 레일 열기", exact: true })
      .click();
  }
  await expect(reviewRail).toBeVisible();
}

async function openAssistantContext(page: Page): Promise<Locator> {
  await openWorkSection(page, "쓰기");
  await openReviewRail(page);
  const reviewRail = page.getByRole("complementary", { name: "검토 레일" });
  await reviewRail.getByRole("tab", { name: "조수", exact: true }).click();
  await reviewRail
    .getByRole("button", { name: "어휘·표기·설정 도구", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "조수 접근 권한" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openWorkSection(
  page: Page,
  section: "쓰기" | "구조" | "검토" | "운영",
): Promise<void> {
  const navigation = page.getByRole("navigation", { name: "작품 작업면" });
  await navigation.getByRole("button", { name: section, exact: true }).click();
}

async function openStructureTab(
  page: Page,
  tab: "개요" | "플롯" | "사건" | "장면" | "인물" | "복선" | "별빛",
): Promise<void> {
  await openWorkSection(page, "구조");
  const workspace = page.getByRole("region", { name: "구조 작업면" });
  await workspace.getByRole("tab", { name: tab, exact: true }).click();
  await expect(workspace.getByRole("tab", { name: tab, exact: true }))
    .toHaveAttribute("aria-selected", "true");
}

async function openReviewTab(
  page: Page,
  tab: "집필 기록" | "원고 점검" | "후보 검토함" | "버전",
): Promise<void> {
  await openWorkSection(page, "검토");
  const workspace = page.getByRole("region", { name: "검토 작업면" });
  await workspace.getByRole("tab", { name: tab, exact: true }).click();
  await expect(workspace.getByRole("tab", { name: tab, exact: true }))
    .toHaveAttribute("aria-selected", "true");
}

async function openWritingRecords(page: Page): Promise<Locator> {
  const workNavigation = page.getByRole("navigation", { name: "작품 작업면" });
  if (!(await workNavigation.isVisible())) {
    await continueFromMain(page);
  }
  await openReviewTab(page, "집필 기록");
  const panel = page.getByRole("region", { name: "집필 기록", exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

async function openLoreCandidateInbox(page: Page): Promise<Locator> {
  await openReviewTab(page, "후보 검토함");
  const inbox = page.getByRole("region", { name: "후보 검토함" });
  await inbox.getByRole("tab", { name: /별빛/u }).click();
  const panel = inbox.getByRole("region", { name: "별빛 검토함" });
  await expect(panel).toBeVisible();
  return panel;
}

async function openSchedule(page: Page): Promise<void> {
  const headerButton = page.getByRole("button", {
    name: "작업 일정 열기",
    exact: true,
  });
  if (await headerButton.isVisible()) {
    await headerButton.click();
  } else {
    await page.getByRole("button", { name: / 일정 열기$/ }).first().click();
  }
  await expect(
    page.getByRole("heading", { name: "일정", exact: true }),
  ).toBeVisible();
}

async function openWorkDocumentFromHome(
  page: Page,
  workTitle: string,
  documentTitle: string,
): Promise<void> {
  const workCard = page.locator(".library-work-card").filter({
    hasText: workTitle,
  });
  await workCard
    .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
  if ((await page.getByTestId("manuscript-title").textContent()) !== documentTitle) {
    await activateDocumentFromTree(page, documentTitle);
  }
}

async function activateDocumentFromTree(
  page: Page,
  documentTitle: string,
): Promise<void> {
  await page
    .getByRole("region", { name: "회차 폴더" })
    .getByRole("button", { name: documentTitle, exact: true })
    .click();
  await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
}

async function createNamedEpisode(
  page: Page,
  title: string,
): Promise<void> {
  await page.getByRole("button", { name: "새 회차", exact: true }).click();
  await expect(page.getByTestId("manuscript-title")).toHaveText("제목없음");
  const documentRail = page.getByRole("complementary", { name: "문서 레일" });
  await documentRail
    .getByRole("button", { name: /제목없음$/u })
    .dblclick();
  const titleInput = documentRail.getByRole("textbox", {
    name: "회차 제목",
    exact: true,
  });
  await titleInput.fill(title);
  await titleInput.press("Enter");
  await expect(page.getByTestId("manuscript-title")).toHaveText(title);
}

async function readActiveDocumentId(page: Page): Promise<string> {
  const documentId = await page
    .locator(".workspace-center")
    .getAttribute("data-active-document-id");
  if (documentId === null || documentId.length === 0) {
    throw new Error("Expected an active Document identity");
  }
  return documentId;
}

async function expectEditorText(
  editor: Locator,
  expected: string,
): Promise<void> {
  await expect
    .poll(() =>
      readEditorText(editor),
    )
    .toBe(expected);
}

async function readEditorText(editor: Locator): Promise<string> {
  return editor.evaluate((element) =>
    Array.from(element.querySelectorAll(":scope > .cm-line"))
      .map((line) => line.textContent ?? "")
      .join("\n"),
  );
}

async function expectDialogFitsDesktop(dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: Number.parseFloat(style.borderRadius),
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width,
    };
  });
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.width).toBeGreaterThan(320);
  expect(layout.height).toBeGreaterThan(200);
  expect(layout.borderRadius).toBeGreaterThanOrEqual(6);
  expect(layout.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
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
  test.setTimeout(60_000);
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
    await expect(page.locator(".studio-app-shell")).toHaveAttribute(
      "data-ui-model",
      "eum-studio-desktop",
    );
    await expect(page.locator(".studio-app-shell")).toHaveAttribute(
      "data-visual-model",
      "novela",
    );
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page.locator(".library-home")).toHaveAttribute(
      "data-layout",
      "eum-studio-library",
    );
    await expect(page.locator(".main-dashboard-real")).toHaveCount(0);
    await expect(page.locator(".dashboard-workspace-tools")).toHaveCount(0);
    await expect(page.locator(".continue-panel")).toHaveCount(0);
    await expect(page.locator(".workspace-notice")).toHaveCount(0);
    await expect(page.locator(".records-overview")).toHaveCount(0);
    await expect(page.locator(".main-page-header .eyebrow")).toHaveCount(0);
    await expect(page.locator(".main-page-header .page-description")).toHaveCount(0);
    await expect(page.locator(".app-topbar")).toBeVisible();
    const nativeCaptionSeparation = await page.evaluate(() => {
      const settings = document.querySelector<HTMLElement>(
        ".app-topbar-settings",
      );
      const controlsOverlay = (
        navigator as Navigator & {
          readonly windowControlsOverlay?: {
            getTitlebarAreaRect(): DOMRect;
          };
        }
      ).windowControlsOverlay;
      if (settings === null || controlsOverlay === undefined) {
        return null;
      }
      const settingsRect = settings.getBoundingClientRect();
      const titlebarArea = controlsOverlay.getTitlebarAreaRect();
      return {
        settingsRight: settingsRect.right,
        titlebarAreaRight: titlebarArea.right,
      };
    });
    expect(nativeCaptionSeparation).not.toBeNull();
    expect(nativeCaptionSeparation?.settingsRight).toBeLessThanOrEqual(
      (nativeCaptionSeparation?.titlebarAreaRight ?? 0) - 6,
    );
    await expect(page.locator(".sidebar-footer")).toHaveCount(0);
    const mainLayout = await page.locator(".library-home").evaluate(
      (element) => {
        const heading = element.querySelector<HTMLElement>(".library-tabs");
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

    await page.keyboard.press("Control+K");
    const quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await expect(quickTools).toBeVisible();
    const quickToolsLayout = await quickTools.evaluate((dialog) => {
      const header = dialog.querySelector<HTMLElement>(".quick-tools-header");
      const body = dialog.querySelector<HTMLElement>(".quick-tools-body");
      const search = dialog.querySelector<HTMLElement>(".quick-tool-search-field");
      const close = dialog.querySelector<HTMLElement>(".dialog-close");
      if (header === null || body === null || search === null || close === null) {
        throw new Error("Quick tools visual structure is incomplete");
      }
      const dialogRect = dialog.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const searchRect = search.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      return {
        display: getComputedStyle(dialog).display,
        width: dialogRect.width,
        headerBeforeBody: headerRect.bottom <= bodyRect.top + 1,
        searchWidth: searchRect.width,
        closeInside:
          closeRect.left >= dialogRect.left &&
          closeRect.right <= dialogRect.right &&
          closeRect.top >= dialogRect.top &&
          closeRect.bottom <= dialogRect.bottom,
      };
    });
    expect(quickToolsLayout.display).toBe("grid");
    expect(quickToolsLayout.width).toBeGreaterThan(520);
    expect(quickToolsLayout.width).toBeLessThan(900);
    expect(quickToolsLayout.headerBeforeBody).toBe(true);
    expect(quickToolsLayout.searchWidth).toBeGreaterThan(400);
    expect(quickToolsLayout.closeInside).toBe(true);
    await quickTools
      .getByRole("button", { name: "빠른 도구 닫기", exact: true })
      .click();
    await expect(quickTools).toBeHidden();

    await page
      .getByRole("button", { name: "앱 설정 열기", exact: true })
      .click();
    const settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toBeVisible();
    const settingsLayout = await settingsDialog.evaluate((dialog) => {
      const header = dialog.querySelector<HTMLElement>(":scope > header");
      const form = dialog.querySelector<HTMLElement>(":scope > form");
      const input = dialog.querySelector<HTMLElement>("input");
      const close = header?.querySelector<HTMLElement>("button") ?? null;
      const footer = dialog.querySelector<HTMLElement>("footer");
      if (
        header === null ||
        form === null ||
        input === null ||
        close === null ||
        footer === null
      ) {
        throw new Error("App settings visual structure is incomplete");
      }
      const dialogRect = dialog.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        width: dialogRect.width,
        headerDisplay: getComputedStyle(header).display,
        headerBeforeForm: headerRect.bottom <= formRect.top + 1,
        inputWidth: inputRect.width,
        footerInside: footerRect.bottom <= dialogRect.bottom + 1,
        closeInside:
          closeRect.left >= dialogRect.left &&
          closeRect.right <= dialogRect.right &&
          closeRect.top >= dialogRect.top &&
          closeRect.bottom <= dialogRect.bottom,
      };
    });
    expect(settingsLayout.width).toBeGreaterThan(360);
    expect(settingsLayout.width).toBeLessThan(560);
    expect(settingsLayout.headerDisplay).toBe("flex");
    expect(settingsLayout.headerBeforeForm).toBe(true);
    expect(settingsLayout.inputWidth).toBeGreaterThan(300);
    expect(settingsLayout.footerInside).toBe(true);
    expect(settingsLayout.closeInside).toBe(true);
    await settingsDialog
      .getByRole("button", { name: "앱 설정 닫기", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();

    await page.setViewportSize({ width: 1344, height: 900 });
    const workTitle = randomUUID();
    const documentTitle = randomUUID();
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
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await expect(page.locator(".writing-workspace")).toHaveAttribute(
      "data-ui-model",
      "eum-studio-editor",
    );
    await expect(page.locator(".manuscript-header")).toHaveClass(
      /eum-editor-breadcrumb/,
    );
    await expect(page.locator(".manuscript-editor-canvas-heading")).toHaveCount(0);
    await expect(page.getByTestId("runtime-status")).toHaveText("");
    await expect(
      page.getByTestId("runtime-status").locator(".runtime-dot"),
    ).toHaveCount(1);
    await expect(
      page
        .locator(".manuscript-header")
        .getByRole("button", { name: "작품 이름 변경", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator(".manuscript-header")
        .getByRole("button", { name: "회차 이름 변경", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".document-switch-label")).toHaveCount(0);
    await expect(page.locator(".document-order-actions")).toHaveCount(0);
    await expect(page.locator(".create-document-form")).toHaveCount(0);
    await expect(
      page.locator(".sidebar .workspace-rail-header h3"),
    ).toHaveText(workTitle);
    await expect(
      page
        .locator(".sidebar .workspace-rail-header")
        .getByRole("button", { name: "작품 이름 변경", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".sidebar .document-tree-document")
        .getByRole("button", { name: "회차 이름 변경", exact: true }),
    ).toBeVisible();
    const editorShellLayout = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>(
        ".sidebar .workspace-rail-left",
      );
      const activeEpisode = document.querySelector<HTMLElement>(
        ".sidebar .document-tree-open.is-active",
      );
      const manuscript = document.querySelector<HTMLElement>(
        ".manuscript-editor .cm-content",
      );
      const canvas = document.querySelector<HTMLElement>(
        ".manuscript-editor-canvas",
      );
      const search = document.querySelector<HTMLElement>(
        ".sidebar .manuscript-search",
      );
      const tree = document.querySelector<HTMLElement>(
        ".sidebar .document-folder-tree",
      );
      const workTitleHeading = document.querySelector<HTMLElement>(
        ".sidebar .workspace-rail-title h3",
      );
      const workTitleEdit = document.querySelector<HTMLElement>(
        '.sidebar .workspace-rail-title [aria-label="작품 이름 변경"]',
      );
      if (
        rail === null ||
        activeEpisode === null ||
        manuscript === null ||
        canvas === null ||
        search === null ||
        tree === null ||
        workTitleHeading === null ||
        workTitleEdit === null
      ) {
        throw new Error("Studio editor shell is incomplete");
      }
      const railRect = rail.getBoundingClientRect();
      const episodeRect = activeEpisode.getBoundingClientRect();
      const manuscriptRect = manuscript.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        episodeOffset: episodeRect.top - railRect.top,
        manuscriptHeight: manuscriptRect.height,
        manuscriptWidth: manuscriptRect.width,
        manuscriptLeft: manuscriptRect.left,
        manuscriptRight: manuscriptRect.right,
        canvasHeight: canvasRect.height,
        canvasWidth: canvasRect.width,
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        centerLeft: canvas.parentElement?.getBoundingClientRect().left ?? 0,
        centerRight: canvas.parentElement?.getBoundingClientRect().right ?? 0,
        searchBeforeTree:
          search.getBoundingClientRect().top < tree.getBoundingClientRect().top,
        workTitleCenterY:
          workTitleHeading.getBoundingClientRect().top +
          workTitleHeading.getBoundingClientRect().height / 2,
        workTitleEditCenterY:
          workTitleEdit.getBoundingClientRect().top +
          workTitleEdit.getBoundingClientRect().height / 2,
      };
    });
    expect(editorShellLayout.episodeOffset).toBeLessThan(260);
    expect(
      Math.abs(
        editorShellLayout.workTitleCenterY -
          editorShellLayout.workTitleEditCenterY,
      ),
    ).toBeLessThan(2);
    expect(editorShellLayout.canvasHeight).toBeGreaterThan(600);
    expect(editorShellLayout.manuscriptHeight).toBeGreaterThan(200);
    expect(editorShellLayout.manuscriptWidth).toBeLessThanOrEqual(820);
    expect(editorShellLayout.manuscriptLeft - editorShellLayout.canvasLeft).toBeCloseTo(
      editorShellLayout.canvasRight - editorShellLayout.manuscriptRight,
      -1,
    );
    expect(editorShellLayout.searchBeforeTree).toBe(true);

    await openStudioHome(page);
    await page.setViewportSize({ width: 886, height: 594 });
    const libraryVerticalRhythm = await page.locator(".library-section").evaluate(
      (element) => {
        const toolbar = element.querySelector<HTMLElement>(".library-heading-row");
        const cards = element.querySelector<HTMLElement>(".library-work-list");
        if (toolbar === null || cards === null) {
          throw new Error("Library layout is incomplete");
        }
        return cards.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom;
      },
    );
    expect(libraryVerticalRhythm).toBeGreaterThanOrEqual(16);
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(
      page
        .getByRole("navigation", { name: "주요 화면" })
        .getByRole("button", { name: "내 작품", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator(".sidebar-utility-navigation").getByRole("button", {
        name: "앱 설정 열기",
        exact: true,
      }),
    ).toBeVisible();
    const mainFitsWithoutPageScroll = await page.locator(".main-page-body").evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    );
    expect(mainFitsWithoutPageScroll).toBe(true);
    await page.locator(".library-work-card").filter({ hasText: workTitle })
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    const recordsPanel = await openWritingRecords(page);
    await expect(recordsPanel.getByRole("region", { name: "연독률 계산기" }))
      .toBeVisible();
    await openStudioHome(page);
    const workCard = page.locator(".library-work-card").filter({
      hasText: workTitle,
    });
    await workCard
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    await workCard
      .getByRole("button", { name: documentTitle, exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();

    await page.setViewportSize({ width: 1344, height: 900 });
    await expect(page.locator(".sidebar .workspace-rail-left")).toHaveCount(1);
    await expect(
      page.locator(".workspace-body > .workspace-rail-left"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "문서 레일 닫기", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "문서 레일 열기", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".workspace-rail-right")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "검토 레일 열기", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "오늘 목표", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("daily-goal-status")).toContainText(
      "오늘 0분",
    );
    await expect(page.getByTestId("daily-goal-status")).toContainText("0자");
    await page.getByRole("button", { name: "오늘 목표", exact: true }).click();
    const dailyGoalDialog = page.getByRole("dialog", { name: "오늘 목표" });
    await expectDialogFitsDesktop(dailyGoalDialog);
    await expect(dailyGoalDialog).toContainText(
      "집중 시간과 글자 수는 집필 기록에서 자동 집계",
    );
    await dailyGoalDialog
      .getByRole("button", { name: "오늘 목표 닫기", exact: true })
      .click();
    await expect(page.getByLabel("행간", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expect(page.getByLabel("행간", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();
    await expect(page.getByLabel("행간", { exact: true })).toHaveCount(0);

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
    const compactControlsDoNotOverlap = await page.evaluate(() => {
      const expand = document.querySelector<HTMLElement>(
        '[aria-label="사이드바 펼치기"]',
      );
      const main = document.querySelector<HTMLElement>(
        ".manuscript-header",
      );
      if (expand === null || main === null) {
        return false;
      }
      const expandRect = expand.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return expandRect.bottom <= mainRect.top;
    });
    expect(compactControlsDoNotOverlap).toBe(true);
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

test("keeps the settings control outside the native window close area", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-native-caption-layout-"),
  );
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(
      page.getByRole("button", { name: "앱 설정 열기", exact: true }),
    ).toBeVisible();
    const separation = await page.evaluate(() => {
      const settings = document.querySelector<HTMLElement>(
        ".app-topbar-settings",
      );
      const controlsOverlay = (
        navigator as Navigator & {
          readonly windowControlsOverlay?: {
            getTitlebarAreaRect(): DOMRect;
          };
        }
      ).windowControlsOverlay;
      if (settings === null || controlsOverlay === undefined) {
        throw new Error("The native window-controls overlay is unavailable");
      }
      const settingsRect = settings.getBoundingClientRect();
      const titlebarArea = controlsOverlay.getTitlebarAreaRect();
      return {
        gap: titlebarArea.right - settingsRect.right,
        settingsRight: settingsRect.right,
        titlebarAreaRight: titlebarArea.right,
      };
    });
    expect(separation.gap).toBeGreaterThanOrEqual(6);
    expect(separation.settingsRight).toBeLessThan(separation.titlebarAreaRight);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists YouTube connection status and Work-owned music settings", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-music-settings-"),
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
    const page = await electronApp.firstWindow();
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog
      .getByLabel("작품 제목")
      .fill(`음악 설정 ${randomUUID()}`);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();

    await page
      .getByRole("button", { name: "앱 설정 열기", exact: true })
      .click();
    let settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByText("YouTube 음악 연결")).toBeVisible();
    await expect(settingsDialog.getByText("현재 작품 음악")).toBeVisible();
    await settingsDialog
      .getByLabel("YouTube Data API 키")
      .fill(`youtube-${randomUUID()}`);
    await settingsDialog
      .getByLabel("회차 전환 시 자동 선곡")
      .check();
    await settingsDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();

    await page
      .getByRole("button", { name: "앱 설정 열기", exact: true })
      .click();
    settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(
      settingsDialog.getByLabel("회차 전환 시 자동 선곡"),
    ).toBeChecked();
    await expect(settingsDialog.getByLabel("YouTube Data API 키"))
      .toHaveValue("");
    await expect(settingsDialog.getByLabel("YouTube Data API 키"))
      .toHaveAttribute("placeholder", /연결됨/u);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages responsive Work cards, names, and persistent favorites from Home", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-home-work-management-"),
  );
  const originalTitle = `한 줄로 보이는 긴 작품 제목 ${randomUUID()}`;
  const renamedTitle = `변경한 작품 제목 ${randomUUID()}`;
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createDialog.getByLabel("작품 제목").fill(originalTitle);
    await createDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await openStudioHome(page);

    await expect(
      page.getByRole("navigation", { name: "주요 화면" })
        .getByRole("button", { name: "내 작품", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".work-create-card")).toHaveCount(0);

    const card = page.locator(".library-work-card").filter({ hasText: originalTitle });
    await expect(card).toBeVisible();
    const layout = await card.evaluate((element) => {
      const title = element.querySelector<HTMLElement>(".work-card-title");
      const actions = element.querySelector<HTMLElement>(".work-card-actions");
      const cardRect = element.getBoundingClientRect();
      const actionsRect = actions?.getBoundingClientRect();
      return {
        titleWhiteSpace: title === null ? null : getComputedStyle(title).whiteSpace,
        actionsInsideCard:
          actionsRect !== undefined && actionsRect.right <= cardRect.right + 1,
      };
    });
    expect(layout).toEqual({ titleWhiteSpace: "nowrap", actionsInsideCard: true });

    await card.getByRole("button", {
      name: `${originalTitle} 즐겨찾기`,
      exact: true,
    }).click();
    await page.getByRole("button", { name: "즐겨찾기 (1)", exact: true }).click();
    await expect(card).toBeVisible();

    await card.getByRole("button", {
      name: `${originalTitle} 작품 이름 변경`,
      exact: true,
    }).click();
    const renameDialog = page.getByRole("dialog", { name: "작품 이름 변경" });
    await renameDialog.getByLabel("작품 제목").fill(renamedTitle);
    await renameDialog.getByRole("button", { name: "변경", exact: true }).click();
    await expect(page.getByText(renamedTitle, { exact: true })).toBeVisible();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "즐겨찾기 (1)", exact: true }).click();
    const restoredCard = page.locator(".library-work-card").filter({ hasText: renamedTitle });
    await expect(restoredCard).toBeVisible();
    await restoredCard.getByRole("button", {
      name: `${renamedTitle} 즐겨찾기 해제`,
      exact: true,
    }).click();
    await expect(page.getByText("즐겨찾기한 작품이 없습니다.", { exact: true }))
      .toBeVisible();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps editor utility dialogs inside one styled desktop surface", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-editor-dialog-layout-"),
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
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill("대화상자 화면 검증");
    await createWorkDialog.getByLabel("첫 회차 제목").fill("제목없음");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await page
      .getByRole("button", { name: "검토 레일 열기", exact: true })
      .click();

    const cases = [
      ["파편 서랍 열기", "파편 서랍", "파편 서랍 닫기"],
    ] as const;

    for (const [openName, dialogName, closeName] of cases) {
      const openButton = page.getByRole("button", {
        name: openName,
        exact: true,
      });
      await expect(openButton).toBeEnabled();
      await openButton.click();
      const dialog = page.getByRole("dialog", { name: dialogName });
      await expectDialogFitsDesktop(dialog);
      await dialog
        .getByRole("button", { name: closeName, exact: true })
        .click();
      await expect(dialog).toBeHidden();
    }

    const assistantContextDialog = await openAssistantContext(page);
    await assistantContextDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    const assistantConnectionsDialog = page.getByRole("dialog", {
      name: "조수 연결",
    });
    await expectDialogFitsDesktop(assistantConnectionsDialog);
    await assistantConnectionsDialog
      .getByRole("button", { name: "조수 연결 닫기", exact: true })
      .click();
    if (await assistantContextDialog.isVisible()) {
      await assistantContextDialog
        .getByRole("button", { name: "조수 접근 권한 닫기", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "검토 레일 닫기", exact: true })
      .click();

    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "연속 읽기", exact: true }).click();
    const continuousReadingDialog = page.getByRole("dialog", {
      name: "연속 읽기",
    });
    await expectDialogFitsDesktop(continuousReadingDialog);
    await continuousReadingDialog
      .getByRole("button", { name: "연속 읽기 닫기", exact: true })
      .click();
    await expect(continuousReadingDialog).toBeHidden();

    await page.getByRole("button", { name: "원고 점검", exact: true }).click();
    const preflightDialog = page.getByRole("dialog", { name: "원고 점검" });
    await expectDialogFitsDesktop(preflightDialog);
    await preflightDialog
      .getByRole("button", { name: "원고 점검 닫기", exact: true })
      .click();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("requires an explicit browser export for the read-only import rehearsal", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-import-rehearsal-"),
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
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 도구 열기", exact: true })
      .click();
    await page
      .getByRole("menu", { name: "작품 도구" })
      .getByRole("menuitem", { name: "가져오기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "기존 작업 가져오기",
    });
    await expect(dialog).toContainText("직접 내보낸 브라우저 데이터 JSON");
    await expect(dialog).toContainText("현재 작업실에는 합치지 않습니다");
    await expect(dialog.getByRole("button", {
      name: "읽기 전용 리허설 실행",
      exact: true,
    })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("runs one explicit browser-export import rehearsal without exposing source values", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-browser-import-"),
  );
  const sourceRootPath = path.join(directory, "legacy-source");
  const sourceDataPath = path.join(sourceRootPath, "data");
  const targetRootPath = path.join(directory, "rehearsal-target");
  const browserBundlePath = path.join(directory, "browser-export.json");
  const workId = randomUUID();
  const documentId = randomUUID();
  const manuscript = `legacy-${randomUUID()}`;
  const browserManuscript = `browser-${randomUUID()}`;
  const browserSecret = `secret-${randomUUID()}`;
  const payload = {
    library: {
      works: [{
        id: workId,
        title: "가져오기 검증 작품",
        description: "",
        episodeIds: [documentId],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      }],
      episodes: [{
        id: documentId,
        workId,
        title: "1화",
        index: 1,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      }],
      episodeFolders: [],
    },
    manuscripts: { [documentId]: manuscript },
    recentWork: {},
    factTemplatesByEpisode: {},
    books: [],
    entries: [],
    sessionLogs: [],
  };
  await mkdir(sourceDataPath, { recursive: true });
  await writeFile(
    path.join(sourceDataPath, "lorebooks.json"),
    JSON.stringify(payload),
    "utf8",
  );
  await writeFile(
    path.join(sourceDataPath, "lorebooks.json.bak"),
    JSON.stringify(payload),
    "utf8",
  );
  const browserBundle = {
    formatIdentity: "eum-browser-source-export",
    formatVersion: "1",
    exportedAt: "2026-08-10T00:00:00.000Z",
    sourceOrigin: "http://localhost",
    localStorageEntries: [
      {
        key: "eum-editor:library:v2",
        value: JSON.stringify(payload.library),
      },
      {
        key: `eum-editor:manuscript:v2:${documentId}`,
        value: browserManuscript,
      },
      {
        key: "eum-editor:ai-provider-settings:v1",
        value: JSON.stringify({ apiKeys: { other: browserSecret } }),
      },
    ],
    indexedDatabases: [
      {
        databaseName: "eum-work-store",
        version: 1,
        stores: [
          {
            storeName: "works",
            records: [{ key: workId, value: { id: workId } }],
          },
          {
            storeName: "backups",
            records: [{
              key: "backup-a",
              value: { id: "backup-a", workId },
            }],
          },
        ],
      },
      {
        databaseName: "eum-publishing-store",
        version: 1,
        stores: [{
          storeName: "publishing-state",
          records: [{ key: "current", value: { submissions: [] } }],
        }],
      },
    ],
  };
  await writeFile(browserBundlePath, JSON.stringify(browserBundle), "utf8");
  const electronApp = await electron.launch({
    args: [
      ".",
      `--user-data-dir=${path.join(directory, "electron-user-data")}`,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    await electronApp.evaluate(
      ({ dialog }, paths) => {
        let openIndex = 0;
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePaths: [paths.openPaths[openIndex++]],
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
      {
        openPaths: [sourceRootPath, browserBundlePath],
        targetPath: targetRootPath,
      },
    );
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 도구 열기", exact: true })
      .click();
    await page
      .getByRole("menu", { name: "작품 도구" })
      .getByRole("menuitem", { name: "가져오기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "기존 작업 가져오기",
    });
    await dialog.getByRole("button", {
      name: "읽기 전용 리허설 실행",
      exact: true,
    }).click();
    await expect(dialog).toContainText("가져오기 리허설 완료");
    await expect(
      dialog.locator("dt", { hasText: "브라우저 항목" })
        .locator("..").locator("dd"),
    ).toHaveText("6");

    const reportPath = path.join(
      targetRootPath,
      "rehearsal-workspace",
      "migration-report.json",
    );
    const reportText = await readFile(reportPath, "utf8");
    expect(reportText).not.toContain(manuscript);
    expect(reportText).not.toContain(browserManuscript);
    expect(reportText).not.toContain(browserSecret);
    expect(reportText).not.toContain(browserBundlePath);
    expect(JSON.parse(reportText).browserSourceReceipt.coverage).toEqual({
      sourceEntryCount: 6,
      capturedEntryCount: 6,
      uncoveredEntryCount: 0,
    });
    expect(
      await readFile(
        path.join(
          targetRootPath,
          "source-archive",
          "raw",
          "browser-source-export.json",
        ),
      ),
    ).toEqual(await readFile(browserBundlePath));
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("edits and restores exact manuscript formatting in the local workspace", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-formatting-"),
  );
  const manuscriptText = "가나다라마바사";
  const formattedText = manuscriptText.slice(1, 4);
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

  const readFormattedTextStyle = (page: Awaited<ReturnType<typeof electronApp.firstWindow>>) =>
    page.locator(".manuscript-editor .cm-line span").evaluateAll(
      (elements, expectedText) => {
        const element = elements.find(
          (candidate) => candidate.textContent === expectedText,
        );
        if (!(element instanceof HTMLElement)) {
          throw new Error("The exact formatted manuscript range is missing");
        }
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontStyle: style.fontStyle,
          fontWeight: style.fontWeight,
          textDecorationLine: style.textDecorationLine,
        };
      },
      formattedText,
    );

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await dialog.getByLabel("작품 제목").fill(randomUUID());
    await dialog.getByLabel("첫 회차 제목").fill(randomUUID());
    await dialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Home");
    await manuscript.press("ArrowRight");
    for (let index = 0; index < formattedText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    await expect(page.getByLabel("본문 글꼴", { exact: true }).locator("option")).toHaveText([
      "마루부리",
      "리디바탕",
      "나눔명조",
      "프리텐다드",
      "나눔고딕",
    ]);
    await page.getByRole("button", { name: "굵게", exact: true }).click();
    await page.getByRole("button", { name: "기울임", exact: true }).click();
    await page.getByRole("button", { name: "밑줄", exact: true }).click();
    await page.getByLabel("본문 글꼴", { exact: true }).selectOption("ridibatang");
    await page.getByLabel("글자 크기", { exact: true }).selectOption("24");
    await expect(
      page.getByRole("button", { name: "글자색 기본값", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "강조색 없음", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "글자색", exact: true })
      .click();
    await page.getByLabel("글자색 선택값", { exact: true }).evaluate(
      (element, value) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("The manuscript text color control is missing");
        }
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        if (setter === undefined) {
          throw new Error("The native color value setter is missing");
        }
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      },
      "#7d2f2f",
    );
    await page
      .getByRole("button", { name: "강조색", exact: true })
      .click();
    await page.getByLabel("강조색 선택값", { exact: true }).evaluate(
      (element, value) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("The manuscript highlight color control is missing");
        }
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        if (setter === undefined) {
          throw new Error("The native highlight value setter is missing");
        }
        setter.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      },
      "#fff0a8",
    );
    await page
      .getByRole("button", { name: "강조색 적용", exact: true })
      .click();
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const additionalFormattingDialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await expect(additionalFormattingDialog).toBeVisible();
    const additionalFormattingGeometry = await additionalFormattingDialog
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          centerX: rect.left + rect.width / 2,
          clientWidth: element.clientWidth,
          left: rect.left,
          right: rect.right,
          scrollWidth: element.scrollWidth,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        };
      });
    expect(
      Math.abs(
        additionalFormattingGeometry.centerX -
          additionalFormattingGeometry.viewportWidth / 2,
      ),
    ).toBeLessThanOrEqual(2);
    expect(additionalFormattingGeometry.left).toBeGreaterThanOrEqual(0);
    expect(additionalFormattingGeometry.right).toBeLessThanOrEqual(
      additionalFormattingGeometry.viewportWidth,
    );
    expect(additionalFormattingGeometry.bottom).toBeLessThanOrEqual(
      additionalFormattingGeometry.viewportHeight,
    );
    expect(additionalFormattingGeometry.scrollWidth).toBeLessThanOrEqual(
      additionalFormattingGeometry.clientWidth + 1,
    );
    await page.getByRole("button", { name: "가운데 정렬", exact: true }).click();
    await page.getByLabel("행간", { exact: true }).selectOption("2.2");
    await page.getByLabel("문단 간격", { exact: true }).selectOption("8");
    await page.getByLabel("자간", { exact: true }).selectOption("0.02");
    const manuscriptWidth = page.getByLabel("본문 폭", { exact: true });
    const defaultMeasuredWidth = await page
      .locator(".manuscript-editor .cm-content")
      .evaluate((element) => element.getBoundingClientRect().width);
    await manuscriptWidth.focus();
    await manuscriptWidth.press("Home");
    await expect(page.locator(".manuscript-width-control output")).toHaveText(
      "480px",
    );
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect
      .poll(() =>
        page
          .locator(".manuscript-editor .cm-content")
          .getAttribute("style"),
      )
      .toContain("480px");

    const narrowedMeasuredWidth = await page
      .locator(".manuscript-editor .cm-content")
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(narrowedMeasuredWidth).toBeLessThan(defaultMeasuredWidth - 150);
    expect(narrowedMeasuredWidth).toBeCloseTo(480, 0);

    await expect
      .poll(() => readFormattedTextStyle(page))
      .toMatchObject({
        backgroundColor: "rgb(255, 240, 168)",
        color: "rgb(125, 47, 47)",
        fontSize: "24px",
        fontStyle: "italic",
        fontWeight: "700",
        textDecorationLine: "underline",
      });
    expect((await readFormattedTextStyle(page)).fontFamily).toContain("RIDIBatang");
    await expect(page.locator(".manuscript-editor .cm-line")).toHaveCSS(
      "text-align",
      "center",
    );
    await expect(page.locator(".manuscript-editor .cm-line")).toHaveCSS(
      "padding-top",
      "8px",
    );
    await expect(page.locator(".manuscript-editor .cm-content")).toHaveCSS(
      "line-height",
      "52.8px",
    );
    await expect(page.locator(".manuscript-editor .cm-content")).toHaveCSS(
      "letter-spacing",
      "0.48px",
    );

    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(page.locator(".manuscript-width-control output")).toHaveText(
      "720px",
    );
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(page.locator(".manuscript-width-control output")).toHaveText(
      "480px",
    );
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await continueFromMain(page);
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveText(
      manuscriptText,
    );
    await expect
      .poll(() => readFormattedTextStyle(page))
      .toMatchObject({
        backgroundColor: "rgb(255, 240, 168)",
        color: "rgb(125, 47, 47)",
        fontSize: "24px",
        fontStyle: "italic",
        fontWeight: "700",
        textDecorationLine: "underline",
      });
    expect((await readFormattedTextStyle(page)).fontFamily).toContain("RIDIBatang");
    await expect
      .poll(() =>
        page
          .locator(".manuscript-editor .cm-content")
          .getAttribute("style"),
      )
      .toContain("480px");
    await expect(page.locator(".manuscript-editor .cm-line")).toHaveCSS(
      "text-align",
      "center",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shares manuscript layout across every episode and restores it after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-layout-e2e-"),
  );
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
  const workTitle = randomUUID();
  const firstTitle = `1화-${randomUUID().slice(0, 8)}`;
  const secondTitle = `2화-${randomUUID().slice(0, 8)}`;
  const expectedSettings = {
    fontFamilyId: "pretendard",
    fontSizePx: 20,
    contentWidthPx: 480,
    lineHeight: 1.75,
    paragraphSpacingPx: 8,
    letterSpacingEm: 0.02,
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const expectSharedLayout = async (page: Page) => {
    await expect(page.getByLabel("본문 글꼴", { exact: true })).toHaveValue(
      expectedSettings.fontFamilyId,
    );
    await expect(page.getByLabel("글자 크기", { exact: true })).toHaveValue(
      String(expectedSettings.fontSizePx),
    );
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveCSS(
      "font-size",
      `${expectedSettings.fontSizePx}px`,
    );
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveCSS(
      "font-family",
      /Pretendard/u,
    );
    const dialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await expect(dialog.getByLabel("행간", { exact: true })).toHaveValue(
      String(expectedSettings.lineHeight),
    );
    await expect(dialog.getByLabel("문단 간격", { exact: true })).toHaveValue(
      String(expectedSettings.paragraphSpacingPx),
    );
    await expect(dialog.getByLabel("자간", { exact: true })).toHaveValue(
      String(expectedSettings.letterSpacingEm),
    );
    await expect(dialog.locator(".manuscript-width-control output")).toHaveText(
      `${expectedSettings.contentWidthPx}px`,
    );
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await page.getByLabel("본문 글꼴", { exact: true })
      .selectOption(expectedSettings.fontFamilyId);
    await page.getByLabel("글자 크기", { exact: true })
      .selectOption(String(expectedSettings.fontSizePx));

    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const firstLayoutDialog = page.getByRole("dialog", {
      name: "추가 서식 도구",
      exact: true,
    });
    await firstLayoutDialog.getByLabel("행간", { exact: true })
      .selectOption(String(expectedSettings.lineHeight));
    await firstLayoutDialog.getByLabel("문단 간격", { exact: true })
      .selectOption(String(expectedSettings.paragraphSpacingPx));
    await firstLayoutDialog.getByLabel("자간", { exact: true })
      .selectOption(String(expectedSettings.letterSpacingEm));
    const width = firstLayoutDialog.getByLabel("본문 폭", { exact: true });
    await width.focus();
    await width.press("Home");
    await expectSharedLayout(page);
    await firstLayoutDialog
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();

    await expect.poll(() => {
      try {
        const database = new DatabaseSync(
          path.join(directory, "workspace.sqlite3"),
          { readOnly: true },
        );
        try {
          const row = database.prepare(`
            SELECT settings_json AS settingsJson
            FROM work_manuscript_layout_settings
          `).get() as { readonly settingsJson?: unknown } | undefined;
          return typeof row?.settingsJson === "string"
            ? JSON.parse(row.settingsJson)
            : null;
        } finally {
          database.close();
        }
      } catch {
        return null;
      }
    }).toEqual(expectedSettings);

    await createNamedEpisode(page, secondTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(secondTitle);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expectSharedLayout(page);
    await page
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expectSharedLayout(page);
    await page
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();
    await activateDocumentFromTree(page, firstTitle);
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await expectSharedLayout(page);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("preflights an exact selection and exports the approved text", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-preflight-"),
  );
  const exportPath = path.join(directory, `${randomUUID()}.txt`);
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
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const source = "앞줄\n선택\t원고  \n뒷줄";
  const approvedSelection = "선택  원고";
  const approvedManuscript = `앞줄\n${approvedSelection}\n뒷줄`;
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
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

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(source);
    await manuscript.press("Control+Home");
    await manuscript.press("ArrowDown");
    await manuscript.press("End");
    await manuscript.press("Shift+Home");
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "원고 점검" }).click();

    let preflightDialog = page.getByRole("dialog", { name: "원고 점검" });
    await expectDialogFitsDesktop(preflightDialog);
    await expect(preflightDialog.getByLabel("선택 범위")).toBeChecked();
    await expect(
      preflightDialog.locator(".preflight-findings").getByText("탭 문자"),
    ).toBeVisible();
    await preflightDialog.getByLabel("탭 문자").selectOption("spaces");
    await preflightDialog.getByLabel("탭 공백 수").fill("2");
    await preflightDialog
      .getByRole("button", { name: "이 작품에 설정 저장" })
      .click();
    await expect(preflightDialog).toContainText(
      "이 작품의 점검 설정을 저장했습니다.",
    );
    await preflightDialog
      .getByRole("button", { name: "미리보기 만들기" })
      .click();
    await expect(
      preflightDialog.getByRole("textbox", { name: "점검 결과" }),
    ).toHaveValue(approvedSelection);
    await expectEditorText(manuscript, source);

    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: selectedPath,
          }),
        });
      },
      exportPath,
    );
    await preflightDialog
      .getByRole("button", { name: "TXT 내보내기" })
      .click();
    await expect(preflightDialog).toContainText("TXT 내보내기를 완료했습니다.");
    expect(await readFile(exportPath, "utf8")).toBe(approvedSelection);

    await preflightDialog
      .getByRole("button", { name: "이 변경 적용" })
      .click();
    await expect(preflightDialog).toBeHidden();
    await expectEditorText(manuscript, approvedManuscript);
    await page.getByRole("button", { name: "실행 취소" }).click();
    await expectEditorText(manuscript, source);
    await page.getByRole("button", { name: "다시 실행" }).click();
    await expectEditorText(manuscript, approvedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    const restartedManuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(restartedManuscript, approvedManuscript);
    await restartedManuscript.click();
    await restartedManuscript.press("Control+End");
    await page
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await page.getByRole("button", { name: "원고 점검" }).click();
    preflightDialog = page.getByRole("dialog", { name: "원고 점검" });
    await expect(preflightDialog.getByLabel("현재 회차 전체")).toBeChecked();
    await expect(preflightDialog.getByLabel("탭 문자")).toHaveValue("spaces");
    await expect(preflightDialog.getByLabel("탭 공백 수")).toHaveValue("2");
    await preflightDialog
      .getByLabel("모든 문단 사이에 빈 줄 한 줄 추가")
      .check();
    await preflightDialog
      .getByRole("button", { name: "미리보기 만들기" })
      .click();
    const manuscriptWithBlankLines = `앞줄\n\n${approvedSelection}\n\n뒷줄`;
    await expect(
      preflightDialog.getByRole("textbox", { name: "점검 결과" }),
    ).toHaveValue(manuscriptWithBlankLines);
    await preflightDialog
      .getByRole("button", { name: "이 변경 적용" })
      .click();
    await expect
      .poll(async () =>
        (
          await restartedManuscript.locator(".cm-line").allTextContents()
        ).join("\n"),
      )
      .toBe(manuscriptWithBlankLines);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates the first local Work and reopens its saved manuscript after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-first-work-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const manuscriptText = randomUUID();
  const revisedSuffix = `-${randomUUID()}`;
  const snapshotLabel = `초고 기준-${randomUUID().slice(0, 8)}`;
  const eventTitle = randomUUID();
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
      page.getByRole("heading", { name: "홈", exact: true }),
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
    for (const label of ["빠른 도구 열기", "메인"]) {
      await expect(
        navigation.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
    await expect(
      navigation.getByRole("button", { name: "내 작품", exact: true }),
    ).toHaveCount(0);
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await expect(createWorkDialog).toBeVisible();
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toBeVisible();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openReviewTab(page, "버전");
    const snapshotRegion = page.getByRole("region", { name: "작품 스냅샷" });
    await snapshotRegion.getByLabel("작품 스냅샷 이름").fill(snapshotLabel);
    await snapshotRegion
      .getByRole("button", { name: "생성", exact: true })
      .click();
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();
    const snapshotRevisionProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null || catalog.activeDocumentId === null) {
        throw new Error("Expected active Work and Document after snapshot");
      }
      return window.eumStudio.version.listDocumentRevisions({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        documentId: catalog.activeDocumentId,
      });
    });
    expect(
      snapshotRevisionProjection.revisions.find((revision) => revision.isCurrent)
        ?.length,
    ).toBe(manuscriptText.length);
    await openWorkSection(page, "쓰기");
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(revisedSuffix);
    await expectEditorText(manuscript, `${manuscriptText}${revisedSuffix}`);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openReviewTab(page, "버전");
    const versionRegion = page.getByRole("region", { name: "문서 버전" });
    await versionRegion
      .getByRole("button", { name: "새로고침", exact: true })
      .click();
    const revisedRevisionProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null || catalog.activeDocumentId === null) {
        throw new Error("Expected active Work and Document before restore");
      }
      return window.eumStudio.version.listDocumentRevisions({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
        documentId: catalog.activeDocumentId,
      });
    });
    expect(
      revisedRevisionProjection.revisions.find((revision) => revision.isCurrent)
        ?.length,
    ).toBe(manuscriptText.length + revisedSuffix.length);
    expect(
      revisedRevisionProjection.revisions.some(
        (revision) =>
          !revision.isCurrent && revision.length === manuscriptText.length,
      ),
    ).toBe(true);
    await versionRegion
      .locator(".version-history-entry")
      .filter({ hasText: `${manuscriptText.length}자` })
      .getByRole("button", { name: /버전으로 복원/ })
      .first()
      .click();
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, manuscriptText);
    await openReviewTab(page, "버전");
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
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
        .getByRole("region", { name: "사건 레일" })
        .getByRole("button", { name: new RegExp(eventTitle) }),
    ).toBeVisible();
    await manuscript.press("ArrowRight");
    await page
      .getByRole("button", { name: "장면 추가", exact: true })
      .click();
    await openStructureTab(page, "장면");
    await expect(
      page
        .getByRole("region", { name: "현재 회차 장면" })
        .getByRole("button", { name: /장면 2/ }),
    ).toBeVisible();
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await expect(page.getByTestId("writing-session-timer")).toBeVisible();
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const focusDialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await focusDialog.getByLabel("작업 시간(분)").fill("37");
    await focusDialog.getByLabel("휴식 시간(분)").fill("5");
    await focusDialog.getByLabel("작업 주기").fill("4");
    await focusDialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(page.getByTestId("pomodoro-timer")).toContainText("작업 1/4");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    const restartedPage = await electronApp.firstWindow();
    await restartedPage.setViewportSize({ width: 1280, height: 800 });
    await expect(
      restartedPage.getByText(workTitle, { exact: true }).first(),
    ).toBeVisible();
    await continueFromMain(restartedPage);
    await restartedPage
      .getByRole("button", { name: "검토 레일 열기", exact: true })
      .click();
    await expectEditorText(
      restartedPage.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
    await expect(
      restartedPage.getByTestId("manuscript-title"),
    ).toHaveText(documentTitle);
    await expect(restartedPage.getByTestId("writing-session-timer")).toBeVisible();
    await expect(restartedPage.getByTestId("pomodoro-timer")).toContainText(
      "작업 1/4",
    );
    await expect(
      restartedPage
        .getByTestId("pomodoro-timer")
        .getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await openReviewTab(restartedPage, "버전");
    await expect(
      restartedPage
        .getByRole("region", { name: "작품 스냅샷" })
        .getByText(snapshotLabel, { exact: true }),
    ).toBeVisible();
    await openWorkSection(restartedPage, "쓰기");
    await openReviewRail(restartedPage);
    await restartedPage.getByRole("tab", { name: "현재", exact: true }).click();
    await restartedPage
      .getByRole("region", { name: "사건 레일" })
      .getByRole("button", { name: new RegExp(eventTitle) })
      .click();
    await expect
      .poll(() =>
        restartedPage.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({ anchor: 0, head: manuscriptText.length });
    await openStructureTab(restartedPage, "장면");
    await restartedPage
      .getByRole("region", { name: "현재 회차 장면" })
      .getByRole("button", { name: /장면 2/ })
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
      .getByTestId("pomodoro-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await expect(
      restartedPage.getByRole("button", { name: "집중 시작", exact: true }),
    ).toBeVisible();
    await expect(
      restartedPage.getByRole("button", { name: "기록 시작", exact: true }),
    ).toBeVisible();
    await openStudioHome(restartedPage);
    await continueFromMain(restartedPage);
    const recordsDialog = await openWritingRecords(restartedPage);
    await expect(recordsDialog).toContainText(workTitle);
    await expect(recordsDialog.getByTestId("records-total-sessions")).toHaveText(
      /세션\s*[1-9]\d*회/u,
    );
    await recordsDialog
      .getByRole("button", {
        name: `${documentTitle} 기록 회차 열기`,
        exact: true,
      })
      .click();
    await expectEditorText(
      restartedPage.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("runs and restores one Work Pomodoro lifecycle without music", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-pomodoro-e2e-"),
  );
  const workTitle = `집중-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await installFakePomodoroAlertAudio(page);
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

    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await expect(dialog.getByText(/음악|소리/u)).toHaveCount(0);
    await dialog.getByLabel("작업 시간(분)").fill("1");
    await dialog.getByLabel("휴식 시간(분)").fill("1");
    await dialog.getByLabel("작업 주기").fill("2");
    await expect(dialog.getByLabel("단계 자동 전환")).not.toBeChecked();
    await dialog.getByRole("button", { name: "시작", exact: true }).click();

    const runningWorkIdValue = await page
      .getByTestId("current-work")
      .getAttribute("title");
    if (runningWorkIdValue === null) {
      throw new Error("Expected running Work identity");
    }
    const runningWorkId = entityId<"Work">(runningWorkIdValue);
    const readPomodoro = () =>
      page.evaluate(
        (workId) => window.eumStudio.activity.getPomodoro({
          schemaVersion: 1,
          workId,
        }),
        runningWorkId,
      );
    let timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("작업 1/2");
    let sessionFeedback = page.getByTestId("session-feedback");
    await expect(sessionFeedback).toBeVisible();
    await expect(sessionFeedback).toHaveAttribute("data-pomodoro-phase", "work");
    await expect(timer).toContainText("완료 0회");
    await expect(
      sessionFeedback.locator(".session-feedback-phase > span"),
    ).toHaveCSS("color", "rgb(217, 119, 6)");
    await sessionFeedback
      .getByRole("button", { name: "세션 피드백 펼치기", exact: true })
      .click();
    await expect(sessionFeedback).toContainText("오늘 세션");
    await expect(sessionFeedback).toContainText("세션 평균");
    await sessionFeedback.getByLabel("세션 메모").fill("작업 중 메모");
    await sessionFeedback
      .getByRole("button", { name: "메모 저장", exact: true })
      .click();
    await expect.poll(readPomodoro).toMatchObject({
      activePhase: { note: "작업 중 메모" },
    });
    await timer.getByRole("button", { name: "일시정지", exact: true }).click();
    await expect.poll(readPomodoro).toMatchObject({
      status: "paused",
      activePhase: { phase: "work", cycleNumber: 1 },
    });
    await expect(
      timer.getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await expect.poll(readPomodoro).toMatchObject({
      status: "running",
      activePhase: { phase: "work", cycleNumber: 1 },
    });
    await timer.getByRole("button", { name: "종료", exact: true }).click();
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await dialog.getByLabel("작업 시간(분)").fill(".1");
    await dialog.getByLabel("휴식 시간(분)").fill(".1");
    await dialog.getByLabel("작업 주기").fill("2");
    await expect(dialog.getByLabel("단계 자동 전환")).not.toBeChecked();
    await dialog.getByRole("button", { name: "시작", exact: true }).click();
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("작업 1/2");
    await page
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    let focusPomodoroStatus = page.getByTestId("focus-pomodoro-status");
    await expect(focusPomodoroStatus).toBeVisible();
    await expect(focusPomodoroStatus).toHaveAttribute(
      "data-pomodoro-phase",
      "work",
    );
    await expect(focusPomodoroStatus).toContainText("작업 모드");
    await expect(focusPomodoroStatus).toContainText("작업 1/2 · 완료 0회");
    await expect(focusPomodoroStatus).toHaveCSS(
      "color",
      "rgb(217, 119, 6)",
    );
    await expect(focusPomodoroStatus).toHaveAttribute(
      "data-pomodoro-phase",
      "break",
      { timeout: 10_000 },
    );
    await expect(focusPomodoroStatus).toContainText("휴식 모드");
    await expect(focusPomodoroStatus).toContainText("휴식 1/2 · 완료 1회");
    await expect(focusPomodoroStatus).toHaveCSS(
      "color",
      "rgb(47, 158, 97)",
    );
    await page.keyboard.press("Escape");
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("휴식 1/2");
    sessionFeedback = page.getByTestId("session-feedback");
    await expect(sessionFeedback).toHaveAttribute("data-pomodoro-phase", "break");
    await expect(timer).toContainText("완료 1회");
    await expect(
      sessionFeedback.locator(".session-feedback-phase > span"),
    ).toHaveCSS("color", "rgb(47, 158, 97)");
    await expect(
      sessionFeedback.locator(".session-feedback-progress > span"),
    ).toHaveCSS("background-color", "rgb(47, 158, 97)");
    let phaseAlert = page.getByTestId("pomodoro-phase-alert");
    await expect(phaseAlert).toHaveAttribute("data-pomodoro-phase", "break");
    await expect(phaseAlert).toContainText("휴식 시간입니다");
    await expect(phaseAlert).toContainText("작업 1/2회 완료");
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __pomodoroAlertSoundCount?: number })
        .__pomodoroAlertSoundCount ?? 0
    )).toBe(1);
    await phaseAlert
      .getByRole("button", { name: "집중 단계 알림 닫기", exact: true })
      .click();
    await expect(phaseAlert).toBeHidden();
    await expect(
      timer.getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          (workId) => window.eumStudio.activity.getPomodoro({
            schemaVersion: 1,
            workId,
          }),
          runningWorkId,
        ),
      )
      .toMatchObject({
        activePhase: {
          state: "running",
          phase: "break",
          pauseReason: null,
        },
      });

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await installFakePomodoroAlertAudio(page);
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("휴식 1/2");
    await expect(page.getByTestId("pomodoro-phase-alert")).toHaveCount(0);
    const restoredWorkIdValue = await page
      .getByTestId("current-work")
      .getAttribute("title");
    if (restoredWorkIdValue === null) {
      throw new Error("Expected restored Work identity");
    }
    const restoredWorkId = entityId<"Work">(restoredWorkIdValue);
    const restoredPomodoro = await page.evaluate(
      (workId) => window.eumStudio.activity.getPomodoro({
        schemaVersion: 1,
        workId,
      }),
      restoredWorkId,
    );
    expect(restoredPomodoro.activePhase).toMatchObject({
      state: "paused",
      pauseReason: "restore",
    });
    await expect(timer).toHaveAttribute(
      "title",
      "이전 실행에서 안전하게 일시정지되었습니다.",
    );
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await page
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    focusPomodoroStatus = page.getByTestId("focus-pomodoro-status");
    await expect(focusPomodoroStatus).toHaveAttribute(
      "data-pomodoro-phase",
      "work",
      { timeout: 9_000 },
    );
    await expect(focusPomodoroStatus).toContainText("작업 모드");
    await expect(focusPomodoroStatus).toContainText("작업 2/2 · 완료 1회");
    await page.keyboard.press("Escape");
    timer = page.getByTestId("pomodoro-timer");
    await expect(timer).toContainText("작업 2/2");
    sessionFeedback = page.getByTestId("session-feedback");
    await expect(sessionFeedback).toHaveAttribute("data-pomodoro-phase", "work");
    await expect(timer).toContainText("완료 1회");
    await expect(
      sessionFeedback.locator(".session-feedback-phase > span"),
    ).toHaveCSS("color", "rgb(217, 119, 6)");
    phaseAlert = page.getByTestId("pomodoro-phase-alert");
    await expect(phaseAlert).toHaveAttribute("data-pomodoro-phase", "work");
    await expect(phaseAlert).toContainText("작업을 재개할 시간입니다");
    await expect(phaseAlert).toContainText("작업 1/2회 완료");
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __pomodoroAlertSoundCount?: number })
        .__pomodoroAlertSoundCount ?? 0
    )).toBe(1);
    await phaseAlert
      .getByRole("button", { name: "집중 단계 알림 닫기", exact: true })
      .click();
    await expect(
      timer.getByRole("button", { name: "재개", exact: true }),
    ).toBeVisible();
    await timer.getByRole("button", { name: "재개", exact: true }).click();
    await expect(page.getByTestId("pomodoro-completed")).toContainText(
      "집중 주기 완료 2/2",
      { timeout: 7_000 },
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expect(page.getByTestId("pomodoro-completed")).toContainText(
      "집중 주기 완료 2/2",
    );
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await expect(dialog.getByLabel("작업 시간(분)")).toHaveValue("0.1");
    await expect(dialog.getByLabel("휴식 시간(분)")).toHaveValue("0.1");
    await expect(dialog.getByLabel("작업 주기")).toHaveValue("2");
    await expect(dialog.getByLabel("단계 자동 전환")).not.toBeChecked();
    await expect(dialog.getByText(/음악|소리/u)).toHaveCount(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("compares one immutable WorkSnapshot across current Documents", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-snapshot-comparison-"),
  );
  const workTitle = `비교-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `첫회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째회차-${randomUUID().slice(0, 8)}`;
  const thirdDocumentTitle = `새회차-${randomUUID().slice(0, 8)}`;
  const firstText = `첫 원고 ${randomUUID()}`;
  const secondText = `둘째 원고 ${randomUUID()}`;
  const changedSuffix = ` 수정 ${randomUUID()}`;
  const thirdText = `새 원고 ${randomUUID()}`;
  const snapshotLabel = `초고 기준-${randomUUID().slice(0, 8)}`;
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
    await manuscript.click();
    await manuscript.pressSequentially(firstText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(page, secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openReviewRail(page);
    const snapshotRegion = page.getByRole("region", { name: "작품 스냅샷" });
    await snapshotRegion.getByLabel("작품 스냅샷 이름").fill(snapshotLabel);
    await snapshotRegion
      .getByRole("button", { name: "생성", exact: true })
      .click();
    await expect(snapshotRegion.getByText(snapshotLabel, { exact: true })).toBeVisible();

    await expect(
      snapshotRegion.getByRole("button", {
        name: `${snapshotLabel} 스냅샷 비교`,
        exact: true,
      }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "검토 레일 닫기" }).click();
    await manuscript.click();
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(changedSuffix);
    await expect(page.getByTestId("manuscript-character-count")).toHaveText(
      String(secondText.length + changedSuffix.length),
    );
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await createNamedEpisode(page, thirdDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(thirdText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openReviewRail(page);
    await snapshotRegion
      .getByRole("button", {
        name: `${snapshotLabel} 스냅샷 비교`,
        exact: true,
      })
      .click();
    const comparisonDialog = page.getByRole("dialog", {
      name: "작품 스냅샷 비교",
    });
    await expect(comparisonDialog).toBeVisible();
    const summary = comparisonDialog.getByRole("region", {
      name: "스냅샷 비교 합계",
    });
    await expect(summary).toContainText(
      `스냅샷 ${(firstText.length + secondText.length).toLocaleString()}자`,
    );
    await expect(summary).toContainText(
      `현재 ${(firstText.length + secondText.length + changedSuffix.length + thirdText.length).toLocaleString()}자`,
    );
    await expect(
      comparisonDialog.getByRole("row").filter({ hasText: firstDocumentTitle }),
    ).toContainText("같음");
    await expect(
      comparisonDialog.getByRole("row").filter({ hasText: secondDocumentTitle }),
    ).toContainText("변경됨");
    await expect(
      comparisonDialog.getByRole("row").filter({ hasText: thirdDocumentTitle }),
    ).toContainText("스냅샷 뒤 추가");
    await expect(comparisonDialog).not.toContainText(firstText);
    await expect(comparisonDialog).not.toContainText(secondText);
    await expect(comparisonDialog).not.toContainText(thirdText);
    await comparisonDialog
      .getByRole("button", { name: "작품 스냅샷 비교 닫기", exact: true })
      .click();
    await expect(comparisonDialog).toBeHidden();
    await expect
      .poll(async () =>
        (
          await manuscript.locator(":scope > .cm-line").allInnerTexts()
        ).join("\n"),
      )
      .toBe(thirdText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("derives Work records from the WritingSession ledger and returns to its exact Document", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-records-"),
  );
  const workTitle = `기록-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
  const manuscriptText = `집필 원장 ${randomUUID()}`;
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

    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await expect(page.getByTestId("writing-session-timer")).toBeVisible();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "기록 시작", exact: true }),
    ).toBeVisible();

    await openStudioHome(page);
    const recordsDialog = await openWritingRecords(page);
    await expect(recordsDialog).toContainText(workTitle);
    await expect(recordsDialog.getByTestId("records-total-sessions")).toContainText(
      "1회",
    );
    await expect(recordsDialog.getByTestId("records-total-delta")).toContainText(
      `+${manuscriptText.length}자`,
    );
    await expect(
      recordsDialog.getByRole("heading", { name: "일별 흐름", exact: true }),
    ).toBeVisible();
    await expect(
      recordsDialog.getByRole("heading", { name: "회차별 기록", exact: true }),
    ).toBeVisible();
    await expect(
      recordsDialog.getByRole("heading", { name: "최근 세션", exact: true }),
    ).toBeVisible();

    await recordsDialog
      .getByRole("button", {
        name: `${documentTitle} 기록 회차 열기`,
        exact: true,
      })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    await expect(page.getByRole("textbox", { name: "원고" })).toHaveText(
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists Work writing goals and derives progress after restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-record-goals-"),
  );
  const workTitle = `목표-${randomUUID().slice(0, 8)}`;
  const documentTitle = `회차-${randomUUID().slice(0, 8)}`;
  const manuscriptText = `목표 집필 ${randomUUID()}`;
  const dailyCharacterGoal = manuscriptText.length + 100;
  const weeklyCharacterGoal = manuscriptText.length + 500;
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

    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();
    await openStudioHome(page);
    let recordsDialog = await openWritingRecords(page);
    await recordsDialog.getByRole("spinbutton", { name: "오늘 집중" }).fill("45");
    await recordsDialog
      .getByRole("spinbutton", { name: "오늘 글자" })
      .fill(String(dailyCharacterGoal));
    await recordsDialog
      .getByRole("spinbutton", { name: "이번 주 집중" })
      .fill("180");
    await recordsDialog
      .getByRole("spinbutton", { name: "이번 주 글자" })
      .fill(String(weeklyCharacterGoal));
    await recordsDialog
      .getByRole("button", { name: "목표 저장", exact: true })
      .click();
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "오늘 글자" }),
    ).toHaveValue(String(dailyCharacterGoal));
    await expect(recordsDialog).toContainText(
      `+${manuscriptText.length} / ${dailyCharacterGoal}자`,
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    recordsDialog = await openWritingRecords(page);
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "오늘 집중" }),
    ).toHaveValue("45");
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "오늘 글자" }),
    ).toHaveValue(String(dailyCharacterGoal));
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "이번 주 집중" }),
    ).toHaveValue("180");
    await expect(
      recordsDialog.getByRole("spinbutton", { name: "이번 주 글자" }),
    ).toHaveValue(String(weeklyCharacterGoal));
    await expect(recordsDialog).toContainText(
      `+${manuscriptText.length} / ${weeklyCharacterGoal}자`,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists Work episode readthrough rates across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-readthrough-"),
  );
  const workTitle = `연독-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `1화-${randomUUID().slice(0, 5)}`;
  const secondDocumentTitle = `2화-${randomUUID().slice(0, 5)}`;
  const thirdDocumentTitle = `3화-${randomUUID().slice(0, 5)}`;
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
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await createNamedEpisode(page, secondDocumentTitle);
    await createNamedEpisode(page, thirdDocumentTitle);

    await openStudioHome(page);
    let recordsDialog = await openWritingRecords(page);
    let calculator = recordsDialog.getByRole("region", {
      name: "연독률 계산기",
    });
    await calculator.getByLabel(`${firstDocumentTitle} 조회수`).fill("1000");
    await calculator.getByLabel(`${secondDocumentTitle} 조회수`).fill("800");
    await calculator.getByLabel(`${thirdDocumentTitle} 조회수`).fill("600");
    await calculator
      .getByRole("button", { name: "연독률 저장", exact: true })
      .click();
    await expect(
      calculator.getByLabel(`${thirdDocumentTitle} 조회수`),
    ).toHaveValue("600");
    await expect(calculator).toContainText("80%");
    await expect(calculator).toContainText("75%");
    await expect(calculator).toContainText("60%");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    recordsDialog = await openWritingRecords(page);
    calculator = recordsDialog.getByRole("region", {
      name: "연독률 계산기",
    });
    await expect(
      calculator.getByLabel(`${firstDocumentTitle} 조회수`),
    ).toHaveValue("1000");
    await expect(
      calculator.getByLabel(`${secondDocumentTitle} 조회수`),
    ).toHaveValue("800");
    await expect(
      calculator.getByLabel(`${thirdDocumentTitle} 조회수`),
    ).toHaveValue("600");
    await expect(calculator).toContainText("80%");
    await expect(calculator).toContainText("75%");
    await expect(calculator).toContainText("60%");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("exports only the selected Work records period as JSON and CSV", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-record-export-"),
  );
  const firstWorkTitle = `제외-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `제외회차-${randomUUID().slice(0, 8)}`;
  const secondWorkTitle = `내보낼작품-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `내보낼회차-${randomUUID().slice(0, 8)}`;
  const jsonPath = path.join(directory, "records.json");
  const csvPath = path.join(directory, "records.csv");
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();

    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await page.getByRole("button", { name: "기록 시작", exact: true }).click();
    await page
      .getByTestId("writing-session-timer")
      .getByRole("button", { name: "종료", exact: true })
      .click();

    await openStudioHome(page);
    const recordsDialog = await openWritingRecords(page);
    await expect(recordsDialog).toContainText(secondWorkTitle);
    const today = await page.evaluate(() => {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    });
    await recordsDialog.getByLabel("기록 시작일").fill(today);
    await recordsDialog.getByLabel("기록 종료일").fill(today);

    await electronApp.evaluate(
      ({ dialog }, selectedPaths) => {
        let index = 0;
        Object.defineProperty(dialog, "showSaveDialog", {
          configurable: true,
          value: async () => ({
            canceled: false,
            filePath: selectedPaths[index++],
          }),
        });
      },
      [jsonPath, csvPath],
    );

    await recordsDialog
      .getByRole("button", { name: "JSON 내보내기", exact: true })
      .click();
    await expect(recordsDialog).toContainText("1개 세션을 내보냈습니다.");
    const jsonText = await readFile(jsonPath, "utf8");
    const jsonValue = JSON.parse(jsonText) as {
      schemaVersion: number;
      work: { workId: string; title: string };
      period: { fromDate: string; toDate: string };
      sessions: Array<{ documentTitle: string }>;
    };
    expect(jsonText).toBe(`${JSON.stringify(jsonValue, null, 2)}\n`);
    expect(jsonValue.schemaVersion).toBe(1);
    expect(jsonValue.work.title).toBe(secondWorkTitle);
    expect(jsonValue.period).toEqual({ fromDate: today, toDate: today });
    expect(jsonValue.sessions).toEqual([
      expect.objectContaining({ documentTitle: secondDocumentTitle }),
    ]);
    expect(jsonText).not.toContain(firstWorkTitle);
    expect(jsonText).not.toContain(firstDocumentTitle);

    await recordsDialog
      .getByRole("button", { name: "CSV 내보내기", exact: true })
      .click();
    await expect
      .poll(() =>
        readFile(csvPath, "utf8").catch(() => null),
      )
      .not.toBeNull();
    const csvText = await readFile(csvPath, "utf8");
    expect(csvText.startsWith(
      "sessionId,documentId,documentTitle,state,startedAt,endedAt,activeDurationMs,characterDelta,note\r\n",
    )).toBe(true);
    expect(csvText.endsWith("\r\n")).toBe(true);
    expect(csvText.split("\r\n")).toHaveLength(3);
    expect(csvText).toContain(secondDocumentTitle);
    expect(csvText).not.toContain(firstDocumentTitle);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

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

test("manages work-owned foreshadow lines across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-foreshadow-lines-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const initialLineTitle = `약속-${randomUUID().slice(0, 8)}`;
  const updatedLineTitle = `회귀-${randomUUID().slice(0, 8)}`;
  const initialNote = `첫 단서 ${randomUUID()}`;
  const updatedNote = `두 번째 단서 ${randomUUID()}`;
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
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await openStructureTab(page, "복선");
    let dialog = page.getByRole("region", { name: "복선 라인" });
    await dialog.getByLabel("새 복선 이름").fill(initialLineTitle);
    await dialog.getByLabel("작가 메모").first().fill(initialNote);
    await dialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await expect(
      dialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(initialLineTitle);
    await expect(
      dialog.getByLabel("복선 작가 메모", { exact: true }),
    ).toHaveValue(initialNote);

    const lineTitleInput = dialog.getByLabel("복선 이름", { exact: true });
    await lineTitleInput.fill(updatedLineTitle);
    await lineTitleInput.press("Tab");
    await expect(lineTitleInput).toBeEnabled();
    const lineNoteInput = dialog.getByLabel("복선 작가 메모", {
      exact: true,
    });
    await lineNoteInput.fill(updatedNote);
    await lineNoteInput.press("Tab");
    await expect(lineNoteInput).toBeEnabled();
    await openWorkSection(page, "쓰기");

    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(dialog).toContainText(
      "이 작품에 만든 복선 라인이 없습니다.",
    );

    await openStudioHome(page);
    await openWorkDocumentFromHome(page, firstWorkTitle, firstDocumentTitle);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(
      dialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(updatedLineTitle);
    await expect(
      dialog.getByLabel("복선 작가 메모", { exact: true }),
    ).toHaveValue(updatedNote);
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(
      dialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(updatedLineTitle);
    await expect(
      dialog.getByLabel("복선 작가 메모", { exact: true }),
    ).toHaveValue(updatedNote);

    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog
      .getByRole("button", { name: "라인 치우기", exact: true })
      .click();
    await expect(dialog).toContainText(
      "이 작품에 만든 복선 라인이 없습니다.",
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(dialog).toContainText(
      "이 작품에 만든 복선 라인이 없습니다.",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages Work-owned characters across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-characters-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const initialName = `윤서-${randomUUID().slice(0, 8)}`;
  const updatedName = `윤서-${randomUUID().slice(0, 8)}`;
  const initialRole = `기록자 ${randomUUID().slice(0, 8)}`;
  const updatedRole = `증언자 ${randomUUID().slice(0, 8)}`;
  const initialSummary = `첫 요약 ${randomUUID()}`;
  const updatedSummary = `수정 요약 ${randomUUID()}`;
  const initialNote = `첫 메모 ${randomUUID()}`;
  const updatedNote = `수정 메모 ${randomUUID()}`;
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
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await openStructureTab(page, "인물");
    let dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");
    await dialog.getByLabel("인물 이름", { exact: true }).fill(initialName);
    await dialog.getByLabel("인물 역할").fill(initialRole);
    await dialog.getByLabel("인물 요약").fill(initialSummary);
    await dialog.getByLabel("인물 작가 메모").fill(initialNote);
    await dialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(initialName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(initialRole);

    await dialog.getByLabel("인물 이름", { exact: true }).fill(updatedName);
    await dialog.getByLabel("인물 역할").fill(updatedRole);
    await dialog.getByLabel("인물 요약").fill(updatedSummary);
    await dialog.getByLabel("인물 작가 메모").fill(updatedNote);
    await dialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(updatedName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(updatedRole);
    await expect(dialog.getByLabel("인물 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("인물 작가 메모")).toHaveValue(updatedNote);
    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");

    await openStudioHome(page);
    await page
      .locator(".library-work-card")
      .filter({ hasText: firstWorkTitle })
      .getByRole("button", {
        name: `${firstWorkTitle} 작품 열기`,
        exact: true,
      })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(updatedName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(updatedRole);
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog.getByLabel("인물 이름", { exact: true })).toHaveValue(updatedName);
    await expect(dialog.getByLabel("인물 역할")).toHaveValue(updatedRole);
    await expect(dialog.getByLabel("인물 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("인물 작가 메모")).toHaveValue(updatedNote);

    await dialog
      .getByRole("button", { name: "인물 치우기", exact: true })
      .click();
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "인물");
    dialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 인물이 없습니다.");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses local inspiration draws and keeps GPT scene work separate", async () => {
  test.setTimeout(240_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-character-oauth-extraction-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `캐릭터 추출 ${suffix}`;
  const documentTitle = `1화 ${suffix}`;
  const characterName = `윤서-${suffix}`;
  const characterAlias = `서린-${suffix}`;
  const generatedCharacterName = `도윤-${suffix}`;
  const generatedRole = `탐정-${suffix}`;
  const generatedPersonality = `집요함-${suffix}`;
  const generatedRelationship = `기록자와 협력-${suffix}`;
  const relatedCharacterName = `재헌-${suffix}`;
  const relationKind = `오래된 동료-${suffix}`;
  const relationDescription = `서로의 판단을 신뢰한다-${suffix}`;
  const generalMusicQuery = `집중 피아노 ${suffix}`;
  const sceneMusicQuery = `바깥 경보 긴장 ${suffix}`;
  const chatPrompt = `이 대화가 연결됐는지 답해줘 ${suffix}`;
  const chatResponse = `GPT 대화 응답 ${suffix}`;
  const vocabularyQuestion = `엄정하다와 비슷한 말 ${suffix}`;
  const vocabularySuggestion = `근엄하다-${suffix}`;
  const sceneDraftPlotTitle = `잠긴 문 플롯 ${suffix}`;
  const sceneDraftDocumentTitle = `장면 초안 회차 ${suffix}`;
  const generatedSceneDraft = `초안 문장 ${suffix}`;
  const editedSceneDraft = `\n수정한 장면 초안 ${suffix}\n`;
  const manuscriptText = [
    `${characterName}는 문 앞에서 상황을 기록했다.`,
    "문이 닫히고 방 안이 조용해졌다.",
    "밖에서 경보가 울리기 시작했다.",
  ].join("\n");
  const receivedRequests: Array<{
    readonly headers: Record<string, string | string[] | undefined>;
    readonly body: Record<string, unknown>;
  }> = [];
  const youtubeSearches: string[] = [];
  const upstream = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (
      request.method === "GET" &&
      requestUrl.pathname === "/youtube/v3/search"
    ) {
      youtubeSearches.push(requestUrl.searchParams.get("q") ?? "");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        items: Array.from({ length: 6 }, (_value, index) => ({
          id: { videoId: `queue-video-${index + 1}` },
          snippet: {
            title: `장면 큐 ${index + 1}`,
            channelTitle: "장면 작곡가",
            thumbnails: {
              medium: {
                url: `https://i.ytimg.com/vi/queue-video-${index + 1}/mqdefault.jpg`,
              },
            },
          },
        })),
      }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
      string,
      unknown
    >;
    receivedRequests.push({ headers: request.headers, body });
    const formatName = (
      body.text as { readonly format?: { readonly name?: unknown } } | undefined
    )?.format?.name;
    const output = formatName === undefined
      ? chatResponse
      : formatName === "eum_assistant_vocabulary_suggestions"
        ? JSON.stringify({
            suggestions: [{
              word: vocabularySuggestion,
              nuance: "무게감이 더 강함",
              example: "근엄한 표정으로 말했다.",
            }],
            note: "현재 질문에 대한 후보",
          })
      : JSON.stringify(formatName === "eum_scene_extraction"
        ? {
            scenes: [
              {
                title: "닫힌 방",
                fromParagraphId: "p1",
                toParagraphId: "p2",
                summary: "기록 뒤 문이 닫힌다.",
                povCharacter: characterName,
                location: "방",
                time: "",
                characters: [characterName],
                goal: "",
                conflict: "문이 닫힌다.",
                outcome: "",
              },
              {
                title: "바깥 경보",
                fromParagraphId: "p3",
                toParagraphId: "p3",
                summary: "밖에서 경보가 울린다.",
                povCharacter: "",
                location: "밖",
                time: "",
                characters: [],
                goal: "",
                conflict: "",
                outcome: "",
              },
            ],
          }
        : formatName === "eum_scene_draft"
          ? { draftText: generatedSceneDraft }
        : formatName === "eum_character_generation"
          ? {
              characters: [{
                name: generatedCharacterName,
                aliases: [],
                role: generatedRole,
                summary: "사건을 추적한다.",
                appearance: "",
                personality: generatedPersonality,
                speech: "",
                goal: "진상 규명",
                conflict: "",
                note: generatedRelationship,
              }],
            }
          : {
            characters: [{
              name: characterName,
              aliases: [characterAlias],
              role: "기록자",
              summary: "상황을 기록한다.",
              appearance: "",
              personality: "",
              speech: "",
              goal: "",
              conflict: "",
              note: "",
              evidences: [{ paragraphId: "p1", quote: characterName }],
            }],
            });
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end([
      "event: response.output_text.delta",
      `data: ${JSON.stringify({ delta: output })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n"));
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once("error", reject);
    upstream.listen(0, "127.0.0.1", () => resolve());
  });
  const address = upstream.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a loopback character extraction server");
  }
  const oauthProfile = {
    schemaVersion: 1,
    providerId: "test-chatgpt-oauth",
    displayName: "GPT",
    issuer: "https://auth.openai.com",
    clientId: "test-client",
    authorizationPath: "/oauth/authorize",
    tokenPath: "/oauth/token",
    scopes: ["openid", "offline_access"],
    authorizeParameters: { originator: "test-originator" },
    callback: {
      listenHost: "127.0.0.1",
      redirectHost: "localhost",
      path: "/auth/callback",
      portRange: { start: 1455, end: 1475 },
    },
    upstream: {
      baseUrl: `http://127.0.0.1:${address.port}`,
      originator: "test-originator",
      clientVersion: "test-version",
      model: "test-model",
    },
  } as const;
  const youtubeProfile = {
    schemaVersion: 1,
    providerId: "youtube",
    displayName: "YouTube",
    searchApiBaseUrl: `http://127.0.0.1:${address.port}/youtube/v3`,
    iframeApiUrl: "https://www.youtube.com/iframe_api",
    watchBaseUrl: "https://www.youtube.com/watch",
    playerReferer: "https://eum-studio/",
    searchLimit: 6,
    videosPerOption: 3,
    requestTimeoutMs: 10_000,
  } as const;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_CHATGPT_OAUTH_PROFILE: JSON.stringify(oauthProfile),
    EUM_STUDIO_YOUTUBE_MUSIC_PROFILE: JSON.stringify(youtubeProfile),
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
    const accountId = `account-${suffix}`;
    const jwt = (payload: Record<string, unknown>) =>
      `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
    const tokens = {
      accessToken: jwt({ exp: 4_000_000_000 }),
      refreshToken: `refresh-${suffix}`,
      idToken: jwt({
        email: `writer-${suffix}@example.test`,
        "https://api.openai.com/auth": {
          chatgpt_account_id: accountId,
          chatgpt_plan_type: "test",
        },
      }),
      accountId,
      email: `writer-${suffix}@example.test`,
      planType: "test",
    };
    const userDataPath = await electronApp.evaluate(({ app }) =>
      app.getPath("userData")
    );
    const encryptedBytes = await electronApp.evaluate(
      ({ safeStorage }, serializedTokens) =>
        Array.from(safeStorage.encryptString(serializedTokens)),
      JSON.stringify(tokens),
    );
    const youtubeEncryptedBytes = await electronApp.evaluate(
      ({ safeStorage }, apiKey) =>
        Array.from(safeStorage.encryptString(apiKey)),
      `youtube-key-${suffix}`,
    );
    await electronApp.close();
    const oauthRoot = path.join(userDataPath, "chatgpt-oauth-v1");
    await mkdir(oauthRoot, { recursive: true });
    await writeFile(
      path.join(oauthRoot, "connection.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        encryptedCredential: Buffer.from(encryptedBytes).toString("base64"),
        updatedAt: "2026-08-17T00:00:00.000Z",
      })}\n`,
      "utf8",
    );
    const youtubeRoot = path.join(userDataPath, "youtube-music-connection-v1");
    await mkdir(youtubeRoot, { recursive: true });
    await writeFile(
      path.join(youtubeRoot, "connection.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        revision: 1,
        encryptedApiKey: Buffer.from(youtubeEncryptedBytes).toString("base64"),
        updatedAt: "2026-08-17T00:00:00.000Z",
      })}\n`,
      "utf8",
    );

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await installFakeYouTubePlayer(page);
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    const settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog).toContainText("YouTube 음악 연결");
    await expect(settingsDialog).toContainText("API 키가 암호화 저장되어 있습니다.");
    await expect(settingsDialog).not.toContainText("Spotify");
    await settingsDialog.getByRole("button", {
      name: "앱 설정 닫기",
      exact: true,
    }).click();
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
    const manuscript = page.getByRole("textbox", { name: "원고" });
    const musicPlayer = page.getByRole("region", { name: "음악 플레이어" });
    await expect(musicPlayer).toContainText("YouTube 재생 대기");
    await expect(musicPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    })).toBeVisible();
    await expect(musicPlayer.getByRole("button", {
      name: "음악 설정 열기",
      exact: true,
    })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "조수", exact: true }))
      .toHaveCount(0);
    await expect(page.getByRole("button", { name: "음악", exact: true }))
      .toHaveCount(0);
    await openReviewRail(page);
    await page.getByRole("tab", { name: "조수", exact: true }).click();
    await expect(page.getByRole("button", {
      name: "어휘·표기·설정 도구",
      exact: true,
    })).toBeVisible();
    await page.getByRole("button", { name: "검토 레일 닫기", exact: true }).click();
    await musicPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const musicLibrary = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await musicLibrary.getByLabel("음악 검색어", { exact: true })
      .fill(generalMusicQuery);
    await musicLibrary.getByRole("button", { name: "검색", exact: true })
      .click();
    await expect.poll(() => youtubeSearches.length).toBe(1);
    expect(youtubeSearches[0]).toContain(generalMusicQuery);
    const generalMusicResult = musicLibrary.getByRole("listitem")
      .filter({ hasText: "장면 큐 1" }).first();
    await expect(generalMusicResult).toBeVisible();
    await generalMusicResult.getByRole("button", {
      name: "장면 큐 1 재생목록에 추가",
      exact: true,
    }).click();
    const secondMusicResult = musicLibrary.getByRole("listitem")
      .filter({ hasText: "장면 큐 2" }).first();
    await secondMusicResult.getByRole("button", {
      name: "장면 큐 2 재생목록에 추가",
      exact: true,
    }).click();
    await expect(musicLibrary.getByRole("region", {
      name: "재생목록",
      exact: true,
    })).toContainText("장면 큐 1");
    await generalMusicResult.getByRole("button", {
      name: "장면 큐 1 선호 영상 저장",
      exact: true,
    }).click();
    await expect(generalMusicResult.getByRole("button", {
      name: "장면 큐 1 선호 영상 해제",
      exact: true,
    })).toBeVisible();
    await generalMusicResult.getByRole("button", {
      name: "장면 큐 1 바로 재생",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual(["load:queue-video-1"]);
    await musicLibrary.getByLabel("음악 검색어", { exact: true })
      .fill(`${generalMusicQuery} 갱신`);
    await musicLibrary.getByRole("button", { name: "검색", exact: true })
      .click();
    await expect.poll(() => youtubeSearches.length).toBe(2);
    const thirdMusicResult = musicLibrary.getByRole("listitem")
      .filter({ hasText: "장면 큐 3" }).first();
    await thirdMusicResult.getByRole("button", {
      name: "장면 큐 3 재생목록에 추가",
      exact: true,
    }).click();
    for (const index of [4, 5, 6]) {
      const result = musicLibrary.getByRole("listitem")
        .filter({ hasText: `장면 큐 ${index}` }).first();
      await result.getByRole("button", {
        name: `장면 큐 ${index} 재생목록에 추가`,
        exact: true,
      }).click();
    }
    const curatedQueue = musicLibrary.getByRole("region", {
      name: "재생목록",
      exact: true,
    });
    await expect(curatedQueue.getByRole("listitem")).toHaveCount(6);
    await expect(curatedQueue).toContainText("장면 큐 1");
    await expect(curatedQueue).toContainText("장면 큐 2");
    await expect(curatedQueue).toContainText("장면 큐 3");
    await expect.poll(() => curatedQueue.locator(
      ".music-library-scroll-list",
    ).evaluate((list) => ({
      clientHeight: list.clientHeight,
      overflowY: getComputedStyle(list).overflowY,
      scrollHeight: list.scrollHeight,
    }))).toMatchObject({ overflowY: "auto" });
    expect(await curatedQueue.locator(".music-library-scroll-list").evaluate(
      (list) => list.scrollHeight > list.clientHeight,
    )).toBe(true);
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return [];
      const settings = await window.eumStudio.settings.getWorkMusic({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return settings.settings.playlistVideos.map((video) => video.videoId);
    })).toEqual(Array.from({ length: 6 }, (_value, index) =>
      `queue-video-${index + 1}`
    ));
    await musicLibrary.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();
    await page.setViewportSize({ width: 960, height: 900 });
    const topbarBounds = await page.locator(".app-topbar").boundingBox();
    const playlistEntryBounds = await musicPlayer.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).boundingBox();
    if (topbarBounds === null || playlistEntryBounds === null) {
      throw new Error("Expected the top bar and playlist entry to be visible");
    }
    expect(playlistEntryBounds.y).toBeGreaterThanOrEqual(topbarBounds.y);
    expect(playlistEntryBounds.y + playlistEntryBounds.height)
      .toBeLessThanOrEqual(topbarBounds.y + topbarBounds.height);
    await page.setViewportSize({ width: 1440, height: 900 });
    await musicPlayer.getByRole("button", {
      name: "음악 정지",
      exact: true,
    }).click();
    await page.evaluate(() => {
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls?.splice(0);
    });
    await page.getByRole("button", { name: "테마 변경", exact: true }).hover();
    await page.getByRole("group", { name: "테마 선택" })
      .getByRole("button", { name: "포커스D", exact: true })
      .click();
    await page.mouse.move(900, 700);
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const focusDialog = page.getByRole("dialog", { name: "집중 타이머 설정" });
    await focusDialog.getByLabel("작업 시간(분)").fill("1");
    await focusDialog.getByLabel("휴식 시간(분)").fill("1");
    await focusDialog.getByLabel("작업 주기").fill("1");
    await focusDialog.getByRole("button", { name: "시작", exact: true }).click();
    await expect(page.getByTestId("pomodoro-timer")).toBeVisible();
    await page.getByRole("button", {
      name: "집중 화면 시작",
      exact: true,
    }).click();
    const focusPomodoroStatus = page.getByLabel("현재 집중 상태", {
      exact: true,
    });
    await expect(focusPomodoroStatus).toBeVisible();
    await expect(focusPomodoroStatus).toContainText("작업 모드");
    await page.locator(".focus-mode-toolbar-host").hover();
    await page.getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();
    await page.waitForTimeout(200);
    expect(await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).toHaveLength(0);
    await page.getByTestId("pomodoro-timer").getByRole("button", {
      name: "종료",
      exact: true,
    }).click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+A");
    await expect(
      page.getByTestId("manuscript-selection-active"),
    ).toBeVisible();

    await openStructureTab(page, "인물");
    const workspace = page.getByRole("region", { name: "인물 작업면" });
    await expect(workspace).toBeVisible();
    const characterDraw = workspace.getByRole("complementary", {
      name: "인물 뽑기",
    });
    await characterDraw.getByRole("button", {
      name: "인물 다시 뽑기",
      exact: true,
    }).click();
    await expect(characterDraw.locator(".inspiration-draw-results > div"))
      .toHaveCount(5);
    await characterDraw.getByLabel("뽑힌 인물 이름").fill(characterName);
    await characterDraw.getByRole("button", {
      name: "인물 항목으로 저장",
      exact: true,
    }).click();
    await expect(workspace.getByLabel("인물 이름", { exact: true }))
      .toHaveValue(characterName);
    await workspace.getByLabel("인물 별칭", { exact: true }).fill(characterAlias);
    await workspace.getByLabel("인물 역할", { exact: true }).fill("기록자");
    await workspace.getByLabel("인물 요약", { exact: true })
      .fill("상황을 기록한다.");
    await workspace.getByRole("button", {
      name: "변경 저장",
      exact: true,
    }).click();

    await workspace.getByRole("button", {
      name: "인물 추가",
      exact: true,
    }).click();
    await workspace.getByLabel("인물 이름", { exact: true })
      .fill(generatedCharacterName);
    await workspace.getByLabel("인물 역할", { exact: true }).fill(generatedRole);
    await workspace.getByLabel("인물 성격과 가치관", { exact: true }).fill(
      generatedPersonality,
    );
    await workspace.getByRole("button", {
      name: "인물 만들기",
      exact: true,
    }).click();

    await workspace.getByRole("button", {
      name: "인물 추가",
      exact: true,
    }).click();
    await workspace.getByLabel("인물 이름", { exact: true })
      .fill(relatedCharacterName);
    await workspace.getByRole("button", {
      name: "인물 만들기",
      exact: true,
    }).click();
    await workspace
      .locator(".character-workspace-list")
      .getByRole("button")
      .filter({ hasText: characterName })
      .click();
    await workspace.getByLabel("관계 대상").selectOption({
      label: relatedCharacterName,
    });
    await workspace.getByLabel("관계 종류", { exact: true }).fill(
      relationKind,
    );
    await workspace.getByLabel("관계 설명", { exact: true }).fill(
      relationDescription,
    );
    await workspace.getByRole("button", {
      name: "관계 추가",
      exact: true,
    }).click();
    await expect(workspace.getByLabel(
      `${characterName} → ${relatedCharacterName} 관계 종류`,
    )).toHaveValue(relationKind);
    await expect(workspace.getByLabel(
      `${characterName} → ${relatedCharacterName} 관계 설명`,
    )).toHaveValue(relationDescription);

    expect(receivedRequests).toHaveLength(0);

    await openWorkSection(page, "쓰기");
    await manuscript.press("Control+A");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page.getByRole("button", {
      name: "선택에서 장면 분석",
      exact: true,
    }).click();
    const plotWorkspace = page.getByRole("region", { name: "구조 작업면" });
    await expect(plotWorkspace.getByRole("tab", {
      name: "장면",
      exact: true,
    })).toHaveAttribute("aria-selected", "true");
    const scenePanel = plotWorkspace.getByRole("region", { name: "장면 뽑기" });
    await scenePanel.getByRole("button", {
      name: "이번 선택 전송 허용",
      exact: true,
    }).click();
    await expect(scenePanel).toContainText("닫힌 방");
    await expect(scenePanel).toContainText("바깥 경보");
    const expectedSceneBoundary = manuscriptText.indexOf("밖에서");
    await expect(scenePanel).toContainText(
      `${expectedSceneBoundary.toLocaleString()}자`,
    );
    await scenePanel.getByRole("button", {
      name: "원고에서 분할선 미리보기",
      exact: true,
    }).click();
    const manuscriptBoundaryPreview = page.locator(
      ".cm-scene-boundary-preview",
    );
    await expect(manuscriptBoundaryPreview).toHaveCount(1);
    await expect(manuscriptBoundaryPreview).toContainText("닫힌 방 → 바깥 경보");
    await openStructureTab(page, "장면");
    const reviewPlotWorkspace = page.getByRole("region", { name: "구조 작업면" });
    await expect(reviewPlotWorkspace.getByRole("tab", {
      name: "장면",
      exact: true,
    })).toHaveAttribute("aria-selected", "true");
    const reviewScenePanel = reviewPlotWorkspace.getByRole("region", {
      name: "장면 뽑기",
    });
    await reviewScenePanel.getByRole("button", {
      name: "분할 승인",
      exact: true,
    }).click();
    await expect(reviewScenePanel).toContainText("분할 저장됨");
    await expect(manuscriptBoundaryPreview).toHaveCount(0);
    const annotationApproval = reviewScenePanel.getByRole("button", {
      name: "장면 정보 승인",
      exact: true,
    });
    await expect(annotationApproval).toHaveCount(2);
    await annotationApproval.first().click();
    await expect(annotationApproval).toHaveCount(1);
    await annotationApproval.first().click();
    await expect(reviewScenePanel.getByText("장면 정보 저장됨", { exact: true }))
      .toHaveCount(2);
    await expect(reviewScenePanel).toContainText("검토 완료");
    await expect(reviewPlotWorkspace.locator("[data-scene-annotation]"))
      .toHaveCount(2);
    await expect(reviewPlotWorkspace.locator(".scene-list-card")).toHaveCount(2);
    const sceneMusicPanels = reviewPlotWorkspace.locator(
      "[data-scene-music-queue]",
    );
    await expect(sceneMusicPanels).toHaveCount(2);
    const targetSceneMusicPanel = reviewPlotWorkspace
      .locator(".scene-list-card")
      .filter({ hasText: "바깥 경보" })
      .locator("[data-scene-music-queue]");
    await targetSceneMusicPanel.getByLabel("확인할 검색어").fill(
      sceneMusicQuery,
    );
    await targetSceneMusicPanel.getByRole("button", {
      name: "이 장면으로 음악 찾기",
      exact: true,
    }).click();
    await expect.poll(() => youtubeSearches.length).toBe(3);
    expect(youtubeSearches[2]).toContain(sceneMusicQuery);
    expect(youtubeSearches[2]).toContain("-shorts");
    await expect(targetSceneMusicPanel.locator("[data-scene-music-candidate]"))
      .toHaveCount(1);
    await expect(targetSceneMusicPanel.locator("[data-scene-music-option]"))
      .toHaveCount(2);
    await targetSceneMusicPanel.getByRole("button", {
      name: "선호 영상 저장: 장면 큐 4",
      exact: true,
    }).click();
    const favoriteVideos = reviewPlotWorkspace.getByRole("region", {
      name: "선호 영상",
      exact: true,
    });
    await expect(favoriteVideos).toContainText("장면 큐 4");
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return [];
      const settings = await window.eumStudio.settings.getWorkMusic({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return settings.settings.favoriteVideos.map((video) => video.videoId);
    })).toEqual(["queue-video-1", "queue-video-4"]);
    expect((await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:"))).toHaveLength(0);
    await targetSceneMusicPanel.getByRole("button", {
      name: "이 재생목록 저장",
      exact: true,
    }).last().click();
    await expect(targetSceneMusicPanel.getByRole("button", {
      name: "저장됨",
      exact: true,
    })).toBeVisible();
    expect((await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:"))).toHaveLength(0);
    await targetSceneMusicPanel.getByRole("button", {
      name: "재생목록 재생",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual(["load:queue-video-4"]);
    await expect(musicPlayer).toContainText("장면 큐 4");
    await musicPlayer.getByRole("button", {
      name: "다음 곡",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual(["load:queue-video-4", "load:queue-video-5"]);
    await musicPlayer.getByRole("button", {
      name: "음악 일시정지",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry === "pause").length).toBe(1);
    await page.getByRole("button", { name: "집중 시작", exact: true }).click();
    const selectedQueueFocusDialog = page.getByRole("dialog", {
      name: "집중 타이머 설정",
    });
    await selectedQueueFocusDialog.getByLabel("작업 시간(분)").fill("1");
    await selectedQueueFocusDialog.getByLabel("휴식 시간(분)").fill("1");
    await selectedQueueFocusDialog.getByLabel("작업 주기").fill("1");
    await selectedQueueFocusDialog.getByRole("button", {
      name: "시작",
      exact: true,
    }).click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toEqual([
        "load:queue-video-4",
        "load:queue-video-5",
        "load:queue-video-4",
      ]);
    expect(receivedRequests).toHaveLength(1);
    expect(receivedRequests[0]?.headers["chatgpt-account-id"]).toBe(accountId);
    expect(receivedRequests[0]?.headers.originator).toBe("test-originator");
    const sceneInput = receivedRequests[0]?.body.input as Array<{
      readonly content: Array<{ readonly text: string }>;
    }>;
    expect(JSON.parse(sceneInput[0]!.content[0]!.text)).toEqual({
      paragraphs: manuscriptText.split("\n").map((text, index) => ({
        id: `p${index + 1}`,
        text,
      })),
    });

    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, sceneDraftDocumentTitle);
    await expect(page.getByTestId("manuscript-title"))
      .toHaveText(sceneDraftDocumentTitle);
    await manuscript.click();
    await openStructureTab(page, "플롯");
    const sceneDraftPlotWorkspace = page.getByRole("region", {
      name: "플롯 작업면",
    });
    const plotBoardWorkspace = sceneDraftPlotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await plotBoardWorkspace.getByLabel("플롯 제목").fill(sceneDraftPlotTitle);
    await plotBoardWorkspace.getByLabel("플롯 단계").fill("전환");
    await plotBoardWorkspace.getByLabel("플롯 요약").fill("잠긴 문을 연다.");
    await plotBoardWorkspace.getByRole("button", {
      name: "플롯 만들기",
      exact: true,
    }).click();
    await plotBoardWorkspace.getByRole("button", {
      name: "예정 사건 만들기",
      exact: true,
    }).click();
    const sceneDraftPanel = plotBoardWorkspace.getByRole("region", {
      name: "장면 초안",
    });
    await expect(sceneDraftPanel).toContainText("연결 사건 1개");
    await sceneDraftPanel.getByLabel(characterName, { exact: true }).check();
    await sceneDraftPanel.getByRole("button", {
      name: "장면 초안 생성",
      exact: true,
    }).click();
    const sceneDraftCandidate = sceneDraftPanel.locator(
      "[data-scene-draft-candidate]",
    ).filter({ hasText: sceneDraftPlotTitle });
    await expect(sceneDraftCandidate).toContainText(generatedSceneDraft);
    await expect(sceneDraftCandidate).toContainText(
      "0자 위치",
    );
    await expect(sceneDraftCandidate.locator(".scene-draft-diff"))
      .toContainText(`+ ${generatedSceneDraft}`);
    expect(await page.locator(
      ".manuscript-workspace-surface .cm-content",
    ).textContent()).not.toContain(generatedSceneDraft);
    expect(receivedRequests).toHaveLength(2);
    expect(receivedRequests[1]?.headers["chatgpt-account-id"]).toBe(accountId);
    const sceneDraftInput = receivedRequests[1]?.body.input as Array<{
      readonly content: Array<{ readonly text: string }>;
    }>;
    expect(JSON.parse(sceneDraftInput[0]!.content[0]!.text)).toEqual({
      plot: {
        title: sceneDraftPlotTitle,
        stage: "전환",
        summary: "잠긴 문을 연다.",
        note: "",
      },
      events: [{
        role: "primary",
        title: sceneDraftPlotTitle,
        note: "잠긴 문을 연다.",
      }],
      characters: [{
        name: characterName,
        aliases: [characterAlias],
        role: "기록자",
        summary: "상황을 기록한다.",
        appearance: expect.any(String),
        personality: expect.any(String),
        speech: expect.any(String),
        goal: "",
        conflict: "",
        note: "",
      }],
      settings: [],
    });
    const sceneDraftEditor = sceneDraftCandidate.getByLabel(
      `${sceneDraftPlotTitle} 장면 초안`,
    );
    await sceneDraftEditor.fill(editedSceneDraft);
    await sceneDraftCandidate.getByRole("button", {
      name: "후보 변경 저장",
      exact: true,
    }).click();
    await expect(sceneDraftCandidate.getByRole("button", {
      name: "이 위치에 삽입",
      exact: true,
    })).toBeEnabled();
    await sceneDraftCandidate.getByRole("button", {
      name: "이 위치에 삽입",
      exact: true,
    }).click();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect.poll(async () => await manuscript.textContent())
      .toContain(editedSceneDraft.trim());

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await installFakeYouTubePlayer(page);
    await expect(page.getByRole("region", { name: "음악 플레이어" }))
      .toContainText("YouTube 재생 대기");
    await page.getByRole("button", {
      name: "선곡·재생목록 열기",
      exact: true,
    }).click();
    const reopenedMusicLibrary = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    const reopenedQueue = reopenedMusicLibrary.getByRole("region", {
      name: "재생목록",
      exact: true,
    });
    await expect(reopenedQueue.getByRole("listitem")).toHaveCount(6);
    await expect(reopenedQueue).toContainText("장면 큐 1");
    await expect(reopenedQueue).toContainText("장면 큐 6");
    await reopenedMusicLibrary.getByRole("button", {
      name: "음악 창 닫기",
      exact: true,
    }).click();
    await openStructureTab(page, "인물");
    const reopenedWorkspace = page.getByRole("region", {
      name: "인물 작업면",
    });
    await expect(reopenedWorkspace.locator(".character-workspace-list"))
      .toContainText(generatedCharacterName);
    await reopenedWorkspace
      .locator(".character-workspace-list")
      .getByRole("button")
      .filter({ hasText: generatedCharacterName })
      .click();
    await expect(reopenedWorkspace.getByLabel("인물 이름", { exact: true })).toHaveValue(
      generatedCharacterName,
    );
    await reopenedWorkspace
      .locator(".character-workspace-list")
      .getByRole("button")
      .filter({ hasText: characterName })
      .click();
    await expect(reopenedWorkspace.getByLabel("인물 이름", { exact: true })).toHaveValue(
      characterName,
    );
    await expect(reopenedWorkspace.getByLabel(
      `${characterName} → ${relatedCharacterName} 관계 종류`,
    )).toHaveValue(relationKind);
    await openWorkSection(page, "쓰기");
    await page.getByRole("button", { name: documentTitle, exact: true })
      .first().click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    await openStructureTab(page, "장면");
    const reopenedPlotWorkspace = page.getByRole("region", {
      name: "구조 작업면",
    });
    await expect(reopenedPlotWorkspace.getByRole("region", {
      name: "장면 뽑기",
    })).toContainText("장면 정보 저장됨");
    await expect(reopenedPlotWorkspace.locator(".scene-list-card")).toHaveCount(2);
    await expect(reopenedPlotWorkspace.locator("[data-scene-annotation]"))
      .toHaveCount(2);
    const reopenedFavorites = reopenedPlotWorkspace.getByRole("region", {
      name: "선호 영상",
      exact: true,
    });
    await expect(reopenedFavorites).toContainText("장면 큐 4");
    await reopenedFavorites.getByRole("listitem")
      .filter({ hasText: "장면 큐 4" })
      .getByRole("button", { name: "재생", exact: true })
      .click();
    await expect.poll(async () => (await page.evaluate(() =>
      (window as unknown as { __youtubePlayerCalls?: string[] })
        .__youtubePlayerCalls ?? []
    )).filter((entry) => entry.startsWith("load:")))
      .toContain("load:queue-video-4");
    const reopenedSceneMusicPanel = reopenedPlotWorkspace
      .locator(".scene-list-card")
      .filter({ hasText: "바깥 경보" })
      .locator("[data-scene-music-queue]");
    await expect(reopenedSceneMusicPanel).toContainText(sceneMusicQuery);
    await expect(reopenedSceneMusicPanel.getByRole("button", {
      name: "저장됨",
      exact: true,
    })).toBeVisible();
    await expect(reopenedSceneMusicPanel.getByRole("button", {
      name: "재생목록 재생",
      exact: true,
    })).toBeVisible();
    await reopenedPlotWorkspace.getByRole("tab", {
      name: "플롯",
      exact: true,
    }).click();
    const reopenedPlotBoard = reopenedPlotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await reopenedPlotBoard.getByRole("button")
      .filter({ hasText: sceneDraftPlotTitle }).first().click();
    const reopenedSceneDraftPanel = reopenedPlotBoard.getByRole("region", {
      name: "장면 초안",
    });
    await expect(reopenedSceneDraftPanel.locator("[data-scene-draft-candidate]"))
      .toContainText("원고 반영됨");
    await expect(reopenedSceneDraftPanel).toContainText(editedSceneDraft.trim());
    await openWorkSection(page, "쓰기");
    await page.getByRole("button", {
      name: sceneDraftDocumentTitle,
      exact: true,
    }).first().click();
    await expect.poll(async () => await page.getByRole("textbox", {
      name: "원고",
    }).textContent()).toContain(editedSceneDraft.trim());
    await openReviewRail(page);
    await page.getByRole("tab", { name: "조수", exact: true }).click();
    await page.getByRole("button", { name: "조수 대화 열기", exact: true }).click();
    const assistantChat = page.getByRole("dialog", {
      name: "GPT 조수 대화",
      exact: true,
    });
    await assistantChat.getByLabel("GPT에게 보낼 메시지", { exact: true })
      .fill(chatPrompt);
    await assistantChat.getByRole("button", {
      name: "GPT에게 보내기",
      exact: true,
    }).click();
    await expect(assistantChat).toContainText(chatResponse);
    await expect.poll(() => receivedRequests.length).toBe(3);
    const chatInput = receivedRequests[2]?.body.input as Array<{
      readonly role: string;
      readonly content: Array<{ readonly text: string }>;
    }>;
    expect(chatInput.at(-1)).toMatchObject({
      role: "user",
      content: [{ text: chatPrompt }],
    });
    await assistantChat.getByRole("button", {
      name: "원고 도구",
      exact: true,
    }).click();
    const assistantTools = page.getByRole("dialog", {
      name: "조수 접근 권한",
      exact: true,
    });
    await expect(assistantTools.getByLabel("어휘 제안 연결", { exact: true }))
      .toContainText("GPT");
    await assistantTools.getByLabel("어휘 제안 질문", { exact: true })
      .fill(vocabularyQuestion);
    await assistantTools.getByRole("button", {
      name: "제안 받기",
      exact: true,
    }).click();
    await expect(assistantTools.getByRole("region", {
      name: "어휘·유의어 제안 결과",
      exact: true,
    })).toContainText(vocabularySuggestion);
    await expect.poll(() => receivedRequests.length).toBe(4);
    expect((receivedRequests[3]?.body.text as {
      readonly format?: { readonly name?: string };
    }).format?.name).toBe("eum_assistant_vocabulary_suggestions");
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages Work-owned plots across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plots-"),
  );
  const firstWorkTitle = randomUUID();
  const firstDocumentTitle = randomUUID();
  const secondWorkTitle = randomUUID();
  const secondDocumentTitle = randomUUID();
  const initialTitle = `사라진 기록-${randomUUID().slice(0, 8)}`;
  const updatedTitle = `돌아온 기록-${randomUUID().slice(0, 8)}`;
  const initialStage = `조사 ${randomUUID().slice(0, 8)}`;
  const updatedStage = `회수 ${randomUUID().slice(0, 8)}`;
  const initialSummary = `첫 요약 ${randomUUID()}`;
  const updatedSummary = `수정 요약 ${randomUUID()}`;
  const initialNote = `첫 메모 ${randomUUID()}`;
  const updatedNote = `수정 메모 ${randomUUID()}`;
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
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await openStructureTab(page, "플롯");
    let dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");
    await dialog.getByLabel("플롯 제목").fill(initialTitle);
    await dialog.getByLabel("플롯 단계").fill(initialStage);
    await dialog.getByLabel("플롯 요약").fill(initialSummary);
    await dialog.getByLabel("플롯 작가 메모").fill(initialNote);
    await dialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(initialTitle);
    await expect(dialog.getByLabel("플롯 단계")).toHaveValue(initialStage);

    await dialog.getByLabel("플롯 제목").fill(updatedTitle);
    await dialog.getByLabel("플롯 단계").fill(updatedStage);
    await dialog.getByLabel("플롯 요약").fill(updatedSummary);
    await dialog.getByLabel("플롯 작가 메모").fill(updatedNote);
    await dialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(updatedTitle);
    await expect(dialog.getByLabel("플롯 단계")).toHaveValue(updatedStage);
    await expect(dialog.getByLabel("플롯 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("플롯 작가 메모")).toHaveValue(updatedNote);

    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog
      .getByLabel("첫 회차 제목")
      .fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");

    await openStudioHome(page);
    await openWorkDocumentFromHome(page, firstWorkTitle, firstDocumentTitle);
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(updatedTitle);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog.getByLabel("플롯 제목")).toHaveValue(updatedTitle);
    await expect(dialog.getByLabel("플롯 단계")).toHaveValue(updatedStage);
    await expect(dialog.getByLabel("플롯 요약")).toHaveValue(updatedSummary);
    await expect(dialog.getByLabel("플롯 작가 메모")).toHaveValue(updatedNote);

    await dialog
      .getByRole("button", { name: "플롯 치우기", exact: true })
      .click();
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog).toContainText("이 작품에 등록한 플롯이 없습니다.");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses the plot list, detail, and local event draw without changing manuscript", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-formal-plot-workspace-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `플롯 작업면 ${suffix}`;
  const documentTitle = `1화 ${suffix}`;
  const manuscriptText = `원고 문장은 플롯 카드 이동과 무관하다 ${suffix}`;
  const firstPlotTitle = `첫 플롯 ${suffix}`;
  const secondPlotTitle = `둘째 플롯 ${suffix}`;
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
    await page.setViewportSize({ width: 786, height: 538 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStructureTab(page, "플롯");
    let workspace = page.getByRole("region", { name: "플롯 작업면" });
    await expect(workspace).toBeVisible();
    const boardSurface = workspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    await boardSurface.getByLabel("플롯 제목").fill(firstPlotTitle);
    await boardSurface.getByRole("button", {
      name: "플롯 만들기",
      exact: true,
    }).click();
    await boardSurface.getByRole("button", { name: "새 플롯", exact: true }).click();
    await boardSurface.getByLabel("플롯 제목").fill(secondPlotTitle);
    await boardSurface.getByRole("button", {
      name: "플롯 만들기",
      exact: true,
    }).click();
    const plotTitles = boardSurface.locator(
      ".plot-manager-list > ul > li > button strong",
    );
    await expect(plotTitles).toHaveText([secondPlotTitle, firstPlotTitle]);
    const eventDraw = workspace.getByRole("complementary", {
      name: "사건 뽑기",
    });
    const customEventKeyword = `비밀 서신 ${suffix}`;
    await eventDraw.getByLabel("사건 뽑기 키워드").fill(customEventKeyword);
    await eventDraw.getByRole("button", { name: "추가", exact: true }).click();
    await expect(eventDraw).toContainText(customEventKeyword);
    await eventDraw.getByRole("button", {
      name: "사건 다시 뽑기",
      exact: true,
    }).click();
    await expect(eventDraw.locator(".inspiration-draw-results > div"))
      .toHaveCount(3);

    await expect(workspace.getByRole("tab", {
      name: "사건 레일",
      exact: true,
    })).toHaveCount(0);
    await openWorkSection(page, "쓰기");
    await expect(page.getByRole("region", {
      name: "사건 레일",
    })).toBeVisible();
    await openStructureTab(page, "장면");
    workspace = page.getByRole("region", { name: "구조 작업면" });
    await expect(workspace.getByRole("region", {
      name: "현재 회차 장면",
    })).toBeVisible();

    await openWorkSection(page, "쓰기");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "플롯");
    workspace = page.getByRole("region", { name: "플롯 작업면" });
    await expect(workspace.locator(
      ".plot-manager-list > ul > li > button strong",
    )).toHaveText([secondPlotTitle, firstPlotTitle]);
    await expect(workspace.getByRole("complementary", {
      name: "사건 뽑기",
    })).toContainText(customEventKeyword);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses the fixed Work header across IA sections and preserves the mounted manuscript", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-ia-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `정보구조 작품-${suffix}`;
  const documentTitle = `정보구조 회차-${suffix}`;
  const manuscriptText = `작업면을 오가도 보존할 원고 ${suffix}`;
  const discardedPlotTitle = `버릴 플롯 초안-${suffix}`;
  const firstPlotTitle = `첫 구조 플롯-${suffix}`;
  const secondPlotTitle = `둘째 구조 플롯-${suffix}`;
  const discardedPartnerName = `버릴 투고처 초안-${suffix}`;
  const partnerName = `운영 투고처-${suffix}`;
  const submissionTitle = `운영 투고 기록-${suffix}`;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const workNavigation = page.getByRole("navigation", { name: "작품 작업면" });
    await expect(workNavigation.getByRole("button")).toHaveText([
      "쓰기",
      "구조",
      "검토",
      "운영",
    ]);
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+A");
    await expect(page.getByTestId("manuscript-selection-active")).toBeVisible();

    await openStructureTab(page, "플롯");
    const plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    const plotTitle = plotWorkspace.getByLabel("플롯 제목");
    await plotTitle.fill(discardedPlotTitle);
    await plotWorkspace.getByRole("button", { name: "새 플롯", exact: true }).click();
    await expect(plotTitle).toHaveValue("");
    await expect(plotTitle).toBeFocused();
    await plotTitle.fill(firstPlotTitle);
    await plotWorkspace
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotWorkspace.getByRole("button", { name: "새 플롯", exact: true }).click();
    await plotWorkspace.getByLabel("플롯 제목").fill(secondPlotTitle);
    await plotWorkspace
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await expect(plotWorkspace.locator(".plot-manager-list strong"))
      .toContainText([secondPlotTitle, firstPlotTitle]);

    await openReviewTab(page, "후보 검토함");
    await expect(page.getByRole("region", { name: "후보 검토함" })).toBeVisible();
    await openWorkSection(page, "운영");
    const workOperations = page.getByRole("region", { name: "작품 운영 작업면" });
    await expect(workOperations).toBeVisible();
    await workOperations.getByRole("button", { name: /^투고/u }).click();
    const publishingDialog = page.getByRole("dialog", { name: "투고" });
    await expect(
      publishingDialog.locator(".publishing-workspace-tabs button:visible"),
    ).toHaveText(["투고 이력", "투고처 원장"]);
    await publishingDialog.getByRole("button", {
      name: "투고처 원장",
      exact: true,
    }).click();
    const partnerNameInput = publishingDialog.getByLabel("투고처 이름");
    await partnerNameInput.fill(discardedPartnerName);
    await publishingDialog.getByRole("button", {
      name: "새 투고처",
      exact: true,
    }).click();
    await expect(partnerNameInput).toHaveValue("");
    await expect(partnerNameInput).toBeFocused();
    await partnerNameInput.fill(partnerName);
    await publishingDialog.getByRole("button", {
      name: "투고처 추가",
      exact: true,
    }).click();
    await expect(partnerNameInput).toHaveValue(partnerName);
    await expect(publishingDialog.getByRole("alert")).toHaveCount(0);
    await publishingDialog.getByRole("button", {
      name: "투고 이력",
      exact: true,
    }).click();
    await publishingDialog.getByRole("button", {
      name: "새 투고 기록",
      exact: true,
    }).click();
    await expect(publishingDialog.getByLabel("투고 작품"))
      .toHaveValue(/.+/u);
    await publishingDialog.getByLabel("투고처 선택")
      .selectOption({ label: partnerName });
    await publishingDialog.getByLabel("투고 기록 제목")
      .fill(submissionTitle);
    await publishingDialog.getByRole("button", {
      name: "현재 원고 버전으로 기록 추가",
      exact: true,
    }).click();
    await expect(publishingDialog).toContainText(submissionTitle);
    await publishingDialog.getByRole("button", {
      name: "투고 운영 닫기",
      exact: true,
    }).click();
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, manuscriptText);
    await expect(page.getByTestId("manuscript-selection-active")).toBeVisible();

    await page.getByRole("button", { name: "작업 일정 열기", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "작업 일정" })).toBeVisible();
    await page.getByRole("button", { name: "작업 일정 닫기", exact: true }).click();

    await openReviewRail(page);
    const inspectorTabs = page.getByRole("complementary", { name: "검토 레일" })
      .getByRole("tablist", { name: "검토 범위" });
    await expect(inspectorTabs.getByRole("tab")).toHaveText(["현재", "조수"]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("flushes the active manuscript before explicit completion and restores completion state", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-document-completion-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `완료 작품-${suffix}`;
  const documentTitle = `완료 회차-${suffix}`;
  const firstText = `완료 직전 원고 ${suffix}`;
  const editedText = ` 완료 뒤 수정 ${suffix}`;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 960, height: 720 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstText);
    await page.getByRole("button", { name: "회차 완료", exact: true }).click();
    await expect(page.getByRole("button", {
      name: "회차 완료 취소",
      exact: true,
    })).toBeVisible();
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("✓");

    const completed = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      const work = catalog.works.find((candidate) =>
        candidate.workId === catalog.activeWorkId
      );
      const document = work?.documents.find((candidate) =>
        candidate.documentId === catalog.activeDocumentId
      );
      return document ?? null;
    });
    expect(completed).not.toBeNull();
    expect(completed?.completion).toMatchObject({
      revision: 1,
      state: "current",
      completedDocumentRevisionId: completed?.currentRevisionId,
    });
    await expectEditorText(manuscript, firstText);

    await openSchedule(page);
    let scheduleDialog = page.getByRole("dialog", { name: "작업 일정" });
    await expect(
      scheduleDialog.getByText(`${documentTitle} 완료`, { exact: true }),
    ).toBeVisible();
    await expect(
      scheduleDialog.getByRole("button", {
        name: `${documentTitle} 완료 취소`,
        exact: true,
      }),
    ).toHaveCount(0);
    await scheduleDialog.getByRole("button", {
      name: "작업 일정 닫기",
      exact: true,
    }).click();

    await page.getByRole("button", {
      name: "작품 목록으로 돌아가기",
      exact: true,
    }).click();
    const todayCompletions = page.locator(".today-completion-list");
    await expect(todayCompletions.getByText(documentTitle, { exact: false }))
      .toBeVisible();
    await todayCompletions.getByRole("button").filter({
      hasText: documentTitle,
    }).click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(documentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });

    await manuscript.pressSequentially(editedText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await expect(page.getByRole("button", {
      name: "회차 다시 완료",
      exact: true,
    })).toBeVisible();
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("△");

    await page.getByRole("button", { name: "회차 다시 완료", exact: true }).click();
    await expect(page.getByRole("button", {
      name: "회차 완료 취소",
      exact: true,
    })).toBeVisible();
    await page.getByRole("button", { name: "회차 완료 취소", exact: true }).click();
    await expect(page.getByRole("button", { name: "회차 완료", exact: true }))
      .toBeVisible();
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("○");

    await openSchedule(page);
    scheduleDialog = page.getByRole("dialog", { name: "작업 일정" });
    await expect(
      scheduleDialog.getByText(`${documentTitle} 완료`, { exact: true }),
    ).toHaveCount(0);
    await scheduleDialog.getByRole("button", {
      name: "작업 일정 닫기",
      exact: true,
    }).click();

    const beforeRestart = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      const work = catalog.works.find((candidate) =>
        candidate.workId === catalog.activeWorkId
      );
      const document = work?.documents.find((candidate) =>
        candidate.documentId === catalog.activeDocumentId
      );
      if (work === undefined || document === undefined) return null;
      const schedule = await window.eumStudio.schedule.listWork({
        schemaVersion: 1,
        workId: work.workId,
        range: { from: "2026-01-01", to: "2026-12-31" },
      });
      return { completion: document.completion, scheduleItems: schedule.items.length };
    });
    expect(beforeRestart).toMatchObject({
      completion: { revision: 3, state: "incomplete" },
      scheduleItems: 0,
    });

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, `${firstText}${editedText}`);
    await expect(page.getByRole("button", { name: "회차 완료", exact: true }))
      .toBeVisible();
    await expect(page.locator(".document-completion-mark").first())
      .toHaveText("○");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("replaces exact plot sources and returns to them across restart", async () => {
  test.setTimeout(120_000);
  const readCurrentManuscriptText = async (manuscript: Locator) =>
    manuscript.evaluate((editor) =>
      Array.from(editor.querySelectorAll(".cm-line"))
        .filter((line) => line.closest(".previous-flow-context") === null)
        .map((line) => line.textContent ?? "")
        .join("\n"),
    );
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-sources-"),
  );
  const workTitle = randomUUID();
  const firstDocumentTitle = `첫 회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째 회차-${randomUUID().slice(0, 8)}`;
  const plotTitle = `사라진 기록-${randomUUID().slice(0, 8)}`;
  const firstPrefix = `${randomUUID()} 앞\n`;
  const firstExactText = `첫 플롯 근거 ${randomUUID()}`;
  const firstSuffix = `\n뒤 ${randomUUID()}`;
  const firstManuscript = `${firstPrefix}${firstExactText}${firstSuffix}`;
  const secondPrefix = `${randomUUID()} 새 앞\n`;
  const secondExactText = `교체한 플롯 근거 ${randomUUID()}`;
  const secondSuffix = `\n새 뒤 ${randomUUID()}`;
  const secondManuscript = `${secondPrefix}${secondExactText}${secondSuffix}`;
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    const firstDocumentId = await readActiveDocumentId(page);
    await manuscript.click();
    await manuscript.pressSequentially(firstManuscript);
    await expect.poll(() => readCurrentManuscriptText(manuscript))
      .toBe(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < firstSuffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < firstExactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(firstExactText);

    await openStructureTab(page, "플롯");
    let dialog = page.getByRole("region", { name: "플롯 작업면" });
    await dialog.getByLabel("플롯 제목").fill(plotTitle);
    await dialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "현재 선택 연결", exact: true })
      .click();
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(firstExactText, { useInnerText: true });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" })).toContainText(
      firstDocumentTitle,
    );
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    const secondDocumentId = await readActiveDocumentId(page);
    expect(secondDocumentId).not.toBe(firstDocumentId);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect.poll(() => readCurrentManuscriptText(manuscript))
      .toBe(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < secondSuffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < secondExactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(secondExactText);

    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await dialog
      .getByRole("button", { name: "현재 선택으로 교체", exact: true })
      .click();
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(secondExactText, { useInnerText: true });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" })).toContainText(
      secondDocumentTitle,
    );
    await openWorkSection(page, "쓰기");
    await activateDocumentFromTree(page, firstDocumentTitle);
    await electronApp.close();

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await openStructureTab(page, "플롯");
    dialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(secondExactText, { useInnerText: true });
    await expect(dialog.getByRole("region", { name: "플롯 원문 출처" })).toContainText(
      secondDocumentTitle,
    );
    await dialog
      .getByRole("button", { name: "원문 열기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(secondExactText);
    await expect.poll(() => readCurrentManuscriptText(manuscript))
      .toBe(secondManuscript);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("derives one Work structure overview and navigates its exact sources", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-work-structure-"),
  );
  const workTitle = `구조 작품-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `첫 회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째 회차-${randomUUID().slice(0, 8)}`;
  const characterName = `기록자-${randomUUID().slice(0, 8)}`;
  const plotTitle = `사라진 기록-${randomUUID().slice(0, 8)}`;
  const eventTitle = `발견 사건-${randomUUID().slice(0, 8)}`;
  const prefix = `${randomUUID()} 앞\n`;
  const exactSource = `정확한 구조 근거 ${randomUUID()}`;
  const suffix = `\n뒤 ${randomUUID()}`;
  const manuscriptText = `${prefix}${exactSource}${suffix}`;
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    const firstDocumentId = await readActiveDocumentId(page);
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactSource.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactSource);

    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("플롯 제목").fill(plotTitle);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "현재 선택 연결", exact: true })
      .click();
    await expect(plotDialog.getByRole("region", { name: "플롯 원문 출처" }).locator("blockquote"))
      .toHaveText(exactSource, { useInnerText: true });
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog
      .getByRole("button", { name: "등록", exact: true })
      .click();
    await manuscript.press("ArrowRight");
    await page
      .getByRole("button", { name: "장면 추가", exact: true })
      .click();

    await openStructureTab(page, "인물");
    let characterDialog = page.getByRole("region", { name: "인물 작업면" });
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(characterName);
    await characterDialog.getByLabel("인물 역할").fill("기록자");
    await characterDialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    const secondDocumentId = await readActiveDocumentId(page);

    await openStructureTab(page, "개요");
    let structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await expect(structureDialog).toContainText(workTitle);
    for (const [testId, count] of [
      ["structure-total-documents", "2"],
      ["structure-total-characters", "1"],
      ["structure-total-plots", "1"],
      ["structure-total-plot-sources", "1"],
      ["structure-total-events", "1"],
      ["structure-total-scenes", "3"],
    ] as const) {
      await expect(structureDialog.getByTestId(testId).locator("strong"))
        .toHaveText(count);
    }
    await expect(structureDialog).toContainText(firstDocumentTitle);
    await expect(structureDialog).toContainText(secondDocumentTitle);
    await expect(structureDialog).toContainText(characterName);
    await expect(structureDialog).toContainText(plotTitle);
    await expect(structureDialog).toContainText(exactSource);
    await expect(structureDialog).toContainText(eventTitle);

    await structureDialog
      .getByRole("button", { name: `${characterName} 인물 열기`, exact: true })
      .click();
    characterDialog = page.getByRole("region", { name: "인물 작업면" });
    await expect(characterDialog.getByLabel("인물 이름", { exact: true })).toHaveValue(
      characterName,
    );
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await structureDialog
      .getByRole("button", { name: `${plotTitle} 플롯 열기`, exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(plotTitle);
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await structureDialog
      .getByRole("region", { name: "회차 구조" })
      .getByRole("button", { name: new RegExp(firstDocumentTitle) })
      .click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await activateDocumentFromTree(page, secondDocumentTitle);
    expect(await readActiveDocumentId(page)).toBe(secondDocumentId);

    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await structureDialog
      .getByRole("button", { name: `${plotTitle} 원문 열기`, exact: true })
      .click();
    await expect(structureDialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactSource);
    expect(await readActiveDocumentId(page)).toBe(firstDocumentId);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("manages Work-owned lore with exact evidence and history across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-entries-"),
  );
  const workTitle = `별빛 작품-${randomUUID().slice(0, 8)}`;
  const firstDocumentTitle = `첫 회차-${randomUUID().slice(0, 8)}`;
  const secondDocumentTitle = `둘째 회차-${randomUUID().slice(0, 8)}`;
  const initialTitle = `북쪽 탑-${randomUUID().slice(0, 8)}`;
  const updatedTitle = `종이 울리는 탑-${randomUUID().slice(0, 8)}`;
  const initialContent = `첫 확정 내용 ${randomUUID()}`;
  const updatedContent = `수정 확정 내용 ${randomUUID()}`;
  const category = `장소-${randomUUID().slice(0, 8)}`;
  const firstPrefix = `${randomUUID()} 앞\n`;
  const firstExactText = `첫 별빛 근거 ${randomUUID()}`;
  const firstSuffix = `\n뒤 ${randomUUID()}`;
  const firstManuscript = `${firstPrefix}${firstExactText}${firstSuffix}`;
  const secondPrefix = `${randomUUID()} 새 앞\n`;
  const secondExactText = `둘째 별빛 근거 ${randomUUID()}`;
  const secondSuffix = `\n새 뒤 ${randomUUID()}`;
  const secondManuscript = `${secondPrefix}${secondExactText}${secondSuffix}`;
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

  const selectExactTextFromEnd = async (
    manuscript: Locator,
    exactText: string,
    suffix: string,
  ) => {
    await manuscript.press("Control+End");
    for (let index = 0; index < suffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    const firstDocumentId = await readActiveDocumentId(page);
    await manuscript.click();
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactTextFromEnd(manuscript, firstExactText, firstSuffix);

    await openStructureTab(page, "개요");
    let structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("0");
    await openStructureTab(page, "별빛");
    let loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await expect(loreDialog).toContainText("이 작품에 등록한 별빛이 없습니다.");
    await loreDialog.getByLabel("별빛 이름").fill(initialTitle);
    await loreDialog.getByLabel("별빛 사용자 분류").fill(category);
    await loreDialog.getByLabel("별빛 별칭").fill("북탑\n종탑");
    await loreDialog.getByLabel("별빛 확정 내용").fill(initialContent);
    await expect(
      loreDialog.getByLabel("현재 선택을 첫 근거로 포함"),
    ).toBeChecked();
    await loreDialog
      .getByRole("button", { name: "별빛 만들기", exact: true })
      .click();
    await expect(loreDialog.getByLabel("별빛 이름")).toHaveValue(initialTitle);
    await expect(loreDialog.locator(".lore-evidence-panel blockquote"))
      .toHaveText(firstExactText, { useInnerText: true });
    await expect(loreDialog.locator(".lore-evidence-panel"))
      .toContainText(firstDocumentTitle);
    await expect(loreDialog.locator(".lore-history-panel")).toContainText("생성");

    await loreDialog.getByLabel("별빛 이름").fill(updatedTitle);
    await loreDialog.getByLabel("별빛 확정 내용").fill(updatedContent);
    await loreDialog.getByLabel("별빛 활성").uncheck();
    await loreDialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    await expect(loreDialog.getByLabel("별빛 이름")).toHaveValue(updatedTitle);
    await expect(loreDialog.getByLabel("별빛 확정 내용"))
      .toHaveValue(updatedContent);
    await expect(loreDialog.locator(".lore-history-panel"))
      .toContainText("내용 변경");
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactTextFromEnd(manuscript, secondExactText, secondSuffix);

    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조 개요" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("1");
    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog
      .getByRole("button", { name: "현재 선택을 근거로 추가", exact: true })
      .click();
    await expect(loreDialog.locator(".lore-evidence-panel blockquote"))
      .toHaveCount(2);
    await expect(loreDialog.locator(".lore-evidence-panel"))
      .toContainText(secondExactText);
    await expect(loreDialog.locator(".lore-history-panel"))
      .toContainText("원고 근거 추가");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await expect(loreDialog.getByLabel("별빛 이름")).toHaveValue(updatedTitle);
    await expect(loreDialog.getByLabel("별빛 사용자 분류")).toHaveValue(category);
    await expect(loreDialog.getByLabel("별빛 별칭")).toHaveValue("북탑\n종탑");
    await expect(loreDialog.getByLabel("별빛 확정 내용"))
      .toHaveValue(updatedContent);
    await expect(loreDialog.getByLabel("별빛 활성")).not.toBeChecked();
    await expect(loreDialog.locator(".lore-evidence-panel blockquote"))
      .toHaveCount(2);
    await expect(loreDialog.locator(".lore-history-panel li")).toHaveCount(3);

    const firstEvidence = loreDialog
      .locator(".lore-evidence-panel li")
      .filter({ hasText: firstExactText });
    await firstEvidence
      .getByRole("button", { name: "원문 열기", exact: true })
      .click();
    await expect(loreDialog).toBeHidden();
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(firstExactText);
    expect(await readActiveDocumentId(page)).toBe(firstDocumentId);

    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog
      .getByRole("button", { name: "별빛 치우기", exact: true })
      .click();
    await expect(loreDialog).toContainText("이 작품에 등록한 별빛이 없습니다.");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("links Work-owned lore and foreshadow lines from both management surfaces across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-foreshadow-links-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `연결 작품-${suffix}`;
  const documentTitle = `첫 회차-${suffix}`;
  const loreTitle = `북쪽 탑-${suffix}`;
  const lineTitle = `세 번의 종소리-${suffix}`;
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

    await openStructureTab(page, "복선");
    let foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    await foreshadowDialog.getByLabel("새 복선 이름").fill(lineTitle);
    await foreshadowDialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await expect(
      foreshadowDialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(
      lineTitle,
    );
    await openStructureTab(page, "별빛");
    let loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog.getByLabel("별빛 이름").fill(loreTitle);
    await loreDialog.getByLabel("별빛 확정 내용").fill("종이 세 번 울린다.");
    await loreDialog
      .getByRole("button", { name: "별빛 만들기", exact: true })
      .click();
    const loreLinks = loreDialog.getByRole("region", {
      name: "별빛과 연결된 복선",
    });
    await loreLinks.getByLabel("연결할 복선").selectOption({ label: lineTitle });
    await loreLinks
      .getByRole("button", { name: "복선 연결", exact: true })
      .click();
    await expect(loreLinks).toContainText(lineTitle);
    await expect(loreLinks.getByRole("button", { name: "연결 해제" }))
      .toHaveCount(1);
    await openStructureTab(page, "복선");
    foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    let foreshadowLoreLinks = foreshadowDialog.getByRole("region", {
      name: `${lineTitle} 연결된 별빛`,
    });
    await expect(foreshadowLoreLinks).toContainText(loreTitle);
    await foreshadowLoreLinks
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(foreshadowLoreLinks).toContainText(
      "아직 연결한 별빛이 없습니다.",
    );
    await foreshadowLoreLinks
      .getByLabel(`${lineTitle} 연결할 별빛`)
      .selectOption({ label: loreTitle });
    await foreshadowLoreLinks
      .getByRole("button", { name: "별빛 연결", exact: true })
      .click();
    await expect(foreshadowLoreLinks).toContainText(loreTitle);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);

    await openStructureTab(page, "별빛");
    loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await expect(
      loreDialog.getByRole("region", { name: "별빛과 연결된 복선" }),
    ).toContainText(lineTitle);
    await loreDialog
      .getByRole("button", { name: "별빛 치우기", exact: true })
      .click();
    await expect(loreDialog).toContainText("이 작품에 등록한 별빛이 없습니다.");
    await openStructureTab(page, "복선");
    foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    await expect(
      foreshadowDialog.getByLabel("복선 이름", { exact: true }),
    ).toHaveValue(
      lineTitle,
    );
    foreshadowLoreLinks = foreshadowDialog.getByRole("region", {
      name: `${lineTitle} 연결된 별빛`,
    });
    await expect(foreshadowLoreLinks).toContainText(
      "먼저 이 작품에 별빛을 만드세요.",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("connects exact foreshadow points and derives payoff across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-foreshadow-points-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const lineTitle = `종소리-${randomUUID().slice(0, 8)}`;
  const prefix = `${randomUUID()} 앞\n`;
  const exactPointText = `  ${randomUUID()} 종소리가 세 번 울렸다.  `;
  const suffix = `\n뒤 ${randomUUID()}`;
  const manuscriptText = `${prefix}${exactPointText}${suffix}`;
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
    for (let index = 0; index < exactPointText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactPointText);

    await openStructureTab(page, "복선");
    let dialog = page.getByRole("region", { name: "복선 라인" });
    await dialog.getByLabel("새 복선 이름").fill(lineTitle);
    await dialog
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    const roleSelect = dialog.getByLabel("지점 역할");
    const captureButton = dialog.getByRole("button", {
      name: "선택 지점 연결",
      exact: true,
    });

    await roleSelect.selectOption("plant");
    await dialog.getByLabel("지점 메모").fill("첫 배치");
    await captureButton.click();
    await expect(dialog.locator(".foreshadow-point-list")).toContainText(
      "배치",
    );
    await expect(dialog.locator(".foreshadow-point-list pre").first())
      .toHaveText(exactPointText, { useInnerText: true });
    await expect(dialog.locator(".foreshadow-line-resolution"))
      .toHaveText("미회수");

    await expect(captureButton).toBeEnabled();
    await roleSelect.selectOption("reinforcement");
    await dialog.getByLabel("지점 메모").fill("강화 단서");
    await captureButton.click();
    await expect(dialog.locator(".foreshadow-point-list")).toContainText(
      "강화",
    );

    await expect(captureButton).toBeEnabled();
    await roleSelect.selectOption("payoff");
    await dialog.getByLabel("지점 메모").fill("회수 지점");
    await captureButton.click();
    await expect(dialog.locator(".foreshadow-point-list")).toContainText(
      "회수",
    );
    await expect(dialog.locator(".foreshadow-line-resolution"))
      .toHaveText("회수 완료");
    await expect(dialog.locator(".foreshadow-point-list > li")).toHaveCount(3);
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    await openStructureTab(page, "복선");
    dialog = page.getByRole("region", { name: "복선 라인" });
    await expect(dialog.locator(".foreshadow-point-list > li")).toHaveCount(3);
    await expect(dialog.locator(".foreshadow-line-resolution"))
      .toHaveText("회수 완료");
    await expect(dialog.locator(".foreshadow-point-list pre").first())
      .toHaveText(exactPointText, { useInnerText: true });
    await dialog
      .getByRole("button", { name: "원문 열기", exact: true })
      .first()
      .click();
    await expect(dialog).toBeHidden();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactPointText);
    await expectEditorText(manuscript, manuscriptText);
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

test("creates, edits, completes, and reopens the active Work schedule from the main screen", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-main-schedule-"),
  );
  const workTitle = `일정 작품 ${randomUUID().slice(0, 8)}`;
  const taskLabel = `검토 ${randomUUID().slice(0, 8)}`;
  const routineLabel = `매일 집필 ${randomUUID().slice(0, 8)}`;
  const ddayLabel = `공모 마감 ${randomUUID().slice(0, 8)}`;
  const editedDdayLabel = `${ddayLabel} 수정`;
  const dateKey = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate(),
    ).padStart(2, "0")}`;
  const todayValue = new Date();
  const today = dateKey(todayValue);
  const deadlineValue = new Date(
    todayValue.getFullYear(),
    todayValue.getMonth(),
    todayValue.getDate() + 5,
  );
  const deadline = dateKey(deadlineValue);
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
    await page.setViewportSize({ width: 1344, height: 900 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    await openStudioHome(page);
    await openSchedule(page);
    await expect(
      page.getByRole("heading", { name: "일정", exact: true }),
    ).toBeVisible();
    await expectDialogFitsDesktop(
      page.getByRole("dialog", { name: "작업 일정" }),
    );

    const quickActions = page.locator(".schedule-quick-actions");
    await quickActions
      .getByRole("button", { name: "일정", exact: true })
      .click();
    let scheduleDialog = page.getByRole("dialog", { name: "일정 추가" });
    await scheduleDialog.getByLabel("이름").fill(taskLabel);
    await scheduleDialog.getByLabel("날짜").fill(today);
    await scheduleDialog.getByLabel("시간").fill("09:30");
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      page.locator(".schedule-agenda-list").getByText(taskLabel, {
        exact: true,
      }),
    ).toBeVisible();

    await quickActions
      .getByRole("button", { name: "루틴", exact: true })
      .click();
    scheduleDialog = page.getByRole("dialog", { name: "루틴 추가" });
    await scheduleDialog.getByLabel("이름").fill(routineLabel);
    await scheduleDialog.getByLabel("시작 날짜").fill(today);
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      page.locator(".schedule-agenda-list").getByText(routineLabel, {
        exact: true,
      }),
    ).toBeVisible();

    await quickActions
      .getByRole("button", { name: "D-DAY", exact: true })
      .click();
    scheduleDialog = page.getByRole("dialog", { name: "D-DAY 추가" });
    await scheduleDialog.getByLabel("마감 이름").fill(ddayLabel);
    await scheduleDialog.getByLabel("날짜").fill(deadline);
    await scheduleDialog.getByLabel("시간").fill("18:00");
    await scheduleDialog.getByLabel("목표 기준").selectOption("episodeCount");
    await scheduleDialog.getByLabel("추가할 회차 수").fill("5");
    await scheduleDialog.getByLabel("현재 완료 회차").fill("2");
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    const ddayEntry = page
      .locator(".schedule-dday-list > button")
      .filter({ hasText: ddayLabel });
    await expect(ddayEntry).toBeVisible();
    await expect(ddayEntry).toContainText("추가 5회차 · 기준 2회차");

    await page
      .getByRole("button", { name: `${taskLabel} 완료`, exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `${taskLabel} 완료 취소`,
        exact: true,
      }),
    ).toBeVisible();

    await ddayEntry.click();
    scheduleDialog = page.getByRole("dialog", { name: "D-DAY 수정" });
    await scheduleDialog.getByLabel("마감 이름").fill(editedDdayLabel);
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      page.locator(".schedule-dday-list").getByText(editedDdayLabel, {
        exact: true,
      }),
    ).toBeVisible();

    await page.setViewportSize({ width: 786, height: 538 });
    const horizontalLayout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      dashboardClientWidth:
        document.querySelector<HTMLElement>(".library-home")
          ?.clientWidth ?? 0,
      dashboardScrollWidth:
        document.querySelector<HTMLElement>(".library-home")
          ?.scrollWidth ?? 0,
    }));
    expect(horizontalLayout.documentWidth).toBeLessThanOrEqual(
      horizontalLayout.viewport,
    );
    expect(horizontalLayout.dashboardScrollWidth).toBeLessThanOrEqual(
      horizontalLayout.dashboardClientWidth,
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1344, height: 900 });
    await openSchedule(page);
    await expect(
      page.getByRole("heading", { name: "일정", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `${taskLabel} 완료 취소`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".schedule-agenda-list").getByText(routineLabel, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator(".schedule-dday-list").getByText(editedDdayLabel, {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists the episode character setting and refreshes D-DAY progress", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-app-settings-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `진척 작품 ${suffix}`;
  const ddayLabel = `연재 목표 ${suffix}`;
  const dateKey = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate(),
    ).padStart(2, "0")}`;
  const deadlineValue = new Date();
  deadlineValue.setDate(deadlineValue.getDate() + 7);
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_APP_SETTINGS_PROFILE: JSON.stringify({
      schemaVersion: 1,
      defaultEpisodeCharacters: {
        defaultValue: 4,
        minValue: 1,
        maxValue: 100,
      },
    }),
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    const createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially("가나다라");
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("4");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await createNamedEpisode(page, "2화");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText("2화");
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("0");
    await manuscript.click();
    await manuscript.pressSequentially("마바");
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("2");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(page);
    await openSchedule(page);
    await expect(page.getByText("1회 완료 기준 4자", { exact: true })).toBeVisible();
    await page
      .locator(".schedule-quick-actions")
      .getByRole("button", { name: "D-DAY", exact: true })
      .click();
    const scheduleDialog = page.getByRole("dialog", { name: "D-DAY 추가" });
    await scheduleDialog.getByLabel("마감 이름").fill(ddayLabel);
    await scheduleDialog.getByLabel("날짜").fill(dateKey(deadlineValue));
    await scheduleDialog.getByLabel("목표 기준").selectOption("episodeCount");
    await scheduleDialog.getByLabel("추가할 회차 수").fill("2");
    await scheduleDialog.getByLabel("현재 완료 회차").fill("0");
    await scheduleDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    const ddayEntry = page
      .locator(".schedule-dday-list > button")
      .filter({ hasText: ddayLabel });
    await expect(ddayEntry).toContainText("추가 완료 1/2회차 · 1회차 남음");

    await page
      .getByRole("button", { name: "작업 일정 닫기", exact: true })
      .click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    let settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toHaveValue("4");
    await settingsDialog.getByLabel("1회 기준 글자수").fill("2");
    await settingsDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(settingsDialog).toBeHidden();
    await openSchedule(page);
    await expect(page.getByText("1회 완료 기준 2자", { exact: true })).toBeVisible();
    await expect(
      page.locator(".schedule-dday-list > button").filter({ hasText: ddayLabel }),
    ).toContainText("추가 완료 2/2회차 · 목표 달성");

    await page
      .getByRole("button", { name: "작업 일정 닫기", exact: true })
      .click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toHaveValue("2");
    await expect(settingsDialog).not.toContainText("provider");
    await expect(settingsDialog).not.toContainText("음악");
    await expect(settingsDialog).not.toContainText("백업");
    await page.setViewportSize({ width: 786, height: 538 });
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>(".app-settings-dialog");
      if (dialog === null) throw new Error("App settings dialog is missing");
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        dialogClientWidth: dialog.clientWidth,
        dialogScrollWidth: dialog.scrollWidth,
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.dialogScrollWidth).toBeLessThanOrEqual(layout.dialogClientWidth);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSchedule(page);
    await expect(page.getByText("1회 완료 기준 2자", { exact: true })).toBeVisible();
    await expect(
      page.locator(".schedule-dday-list > button").filter({ hasText: ddayLabel }),
    ).toContainText("추가 완료 2/2회차 · 목표 달성");
    await page
      .getByRole("button", { name: "작업 일정 닫기", exact: true })
      .click();
    await page.getByRole("button", { name: "앱 설정 열기", exact: true }).click();
    settingsDialog = page.getByRole("dialog", { name: "앱 설정" });
    await expect(settingsDialog.getByLabel("1회 기준 글자수")).toHaveValue("2");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("switches Works with Ctrl+K and restores the exact per-Work quick memo", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-quick-tools-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const firstWorkTitle = `정원 ２ ${suffix}`;
  const firstDocumentTitle = `２화 재회 ${suffix}`;
  const secondWorkTitle = `바다 ${suffix}`;
  const secondDocumentTitle = `3화 이별 ${suffix}`;
  const firstManuscript = `첫 작품 원고 ${randomUUID()}`;
  const secondManuscript = `둘째 작품 원고 ${randomUUID()}`;
  const quickMemo = `  확인 ${randomUUID()}\n둘째 줄  `;
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let createWorkDialog = page.getByRole("dialog", {
      name: "새 작품 만들기",
    });
    await createWorkDialog.getByLabel("작품 제목").fill(firstWorkTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(page);
    await page
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(secondWorkTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(secondDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    await expect(page.getByTestId("manuscript-character-count")).toHaveText("0");
    await manuscript.pressSequentially(secondManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await page.keyboard.press("Control+K");
    let quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await expect(quickTools).toBeVisible();
    const quickSearch = quickTools.getByRole("searchbox", {
      name: "작품, 회차 또는 명령 검색",
    });
    const results = quickTools.getByRole("option");
    await expect(results.first()).toHaveAttribute("aria-selected", "true");
    await quickSearch.press("ArrowDown");
    await expect(results.nth(1)).toHaveAttribute("aria-selected", "true");
    await quickSearch.press("ArrowUp");
    await expect(results.first()).toHaveAttribute("aria-selected", "true");

    await quickTools
      .getByRole("button", { name: "빠른 메모 열기", exact: true })
      .click();
    const memo = quickTools.getByLabel(`${secondWorkTitle} 빠른 메모`);
    await expect(memo).toBeVisible();
    await memo.fill(quickMemo);
    const saveMemo = quickTools.getByRole("button", {
      name: "메모 저장",
      exact: true,
    });
    await saveMemo.click();
    await expect(saveMemo).toBeDisabled();
    await expect(quickTools.getByText("저장된 메모 없음", { exact: true }))
      .toHaveCount(0);

    await quickSearch.fill("2화");
    await expect(quickTools.getByRole("option")).toHaveCount(1);
    await expect(quickTools.getByRole("option").first()).toContainText(
      firstDocumentTitle,
    );
    await quickSearch.press("Enter");
    await expect(quickTools).toBeHidden();
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, firstManuscript);
    await expect(manuscript).not.toContainText(quickMemo.trim());

    await page.keyboard.press("Control+K");
    quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .fill(secondDocumentTitle);
    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .press("Enter");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, secondManuscript);
    await expect(manuscript).not.toContainText(quickMemo.trim());

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 786, height: 538 });
    await expect(
      page.getByRole("button", { name: "빠른 도구 열기", exact: true }),
    ).toBeEnabled();
    await page.keyboard.press("Control+K");
    quickTools = page.getByRole("dialog", { name: "빠른 도구" });
    await quickTools
      .getByRole("button", { name: "빠른 메모 열기", exact: true })
      .click();
    await expect(quickTools.getByLabel(`${secondWorkTitle} 빠른 메모`))
      .toHaveValue(quickMemo);
    const layout = await page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>(".quick-tools-dialog");
      if (dialog === null) throw new Error("Quick tools dialog is missing");
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        dialogClientWidth: dialog.clientWidth,
        dialogScrollWidth: dialog.scrollWidth,
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.dialogScrollWidth).toBeLessThanOrEqual(layout.dialogClientWidth);

    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .fill(secondDocumentTitle);
    await quickTools
      .getByRole("searchbox", { name: "작품, 회차 또는 명령 검색" })
      .press("Enter");
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, secondManuscript);
    await expect(manuscript).not.toContainText(quickMemo.trim());
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists a Work-scoped exact vocabulary Candidate and its permission", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-context-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const destinationId = "local-exact-vocabulary-search";
  const query = "서늘한";
  const manuscriptText = `${query} 복도와 ${query} 창문 ${randomUUID()}`;
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
    await manuscript.press("Control+Home");
    for (let index = 0; index < query.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    await page.getByRole("button", { name: "조수", exact: true }).click();
    let permissionDialog = page.getByRole("dialog", {
      name: "조수 접근 권한",
    });
    await expect(permissionDialog).toBeVisible();
    await expect(permissionDialog.getByLabel("기능 목적지"))
      .toHaveValue(destinationId);
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    let permissionLedger = permissionDialog.getByRole("region", {
      name: "조수 권한 목록",
    });
    await expect(permissionLedger.getByText(destinationId, { exact: true }))
      .toBeVisible();
    await expect(
      permissionLedger.getByText(
        "로컬 작품 전체 · 외부 전송하지 않음 · 이 작품",
        { exact: true },
      ),
    ).toBeVisible();
    await permissionDialog
      .getByRole("button", { name: "선택 어휘 검색", exact: true })
      .click();
    const candidateLedger = permissionDialog.getByRole("region", {
      name: "어휘 검색 결과",
    });
    await expect(
      candidateLedger.locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expect(candidateLedger.getByText("2곳", { exact: true })).toBeVisible();
    const receiptLedger = permissionDialog.getByRole("region", {
      name: "조수 접근 기록",
    });
    await expect(
      receiptLedger.getByText(
        `읽기 ${manuscriptText.length.toLocaleString()}자 · 전송 0자`,
        { exact: true },
      ),
    ).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
    await candidateLedger
      .getByRole("button", {
        name: `1. ${documentTitle} 0–${query.length}`,
        exact: true,
      })
      .click();
    await expect(permissionDialog).toBeHidden();
    await expect
      .poll(() =>
        page.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({ anchor: 0, head: query.length });
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    permissionDialog = await openAssistantContext(page);
    permissionLedger = permissionDialog.getByRole("region", {
      name: "조수 권한 목록",
    });
    await expect(permissionLedger.getByText(destinationId, { exact: true }))
      .toBeVisible();
    const reopenedCandidateLedger = permissionDialog.getByRole("region", {
      name: "어휘 검색 결과",
    });
    await expect(
      reopenedCandidateLedger.locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expect(
      reopenedCandidateLedger.getByText("2곳", { exact: true }),
    ).toBeVisible();
    await permissionLedger
      .getByRole("button", { name: "철회", exact: true })
      .click();
    await expect(permissionLedger.getByText(/철회됨/u)).toBeVisible();

    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await page.getByRole("button", { name: "조수", exact: true }).click();
    permissionDialog = page.getByRole("dialog", {
      name: "조수 접근 권한",
    });
    permissionLedger = permissionDialog.getByRole("region", {
      name: "조수 권한 목록",
    });
    await expect(permissionLedger.getByText(destinationId, { exact: true }))
      .toBeVisible();
    await expect(permissionLedger.getByText(/철회됨/u)).toBeVisible();
    await expect(permissionLedger.getByRole("button", { name: "철회" }))
      .toHaveCount(0);
    await expect(
      permissionDialog
        .getByRole("region", { name: "어휘 검색 결과" })
        .locator(`[data-candidate-query="${query}"]`),
    ).toBeVisible();
    await expectEditorText(
      page.getByRole("textbox", { name: "원고" }),
      manuscriptText,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists exact-selection notation Candidates without changing the manuscript", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-notation-review-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const forbiddenTerm = `금칙-${randomUUID()}`;
  const destinationId = "local-selected-notation-review";
  const manuscriptText = `범위 밖 ${forbiddenTerm}\n선택 ${forbiddenTerm} 끝`;
  const selectionFrom = manuscriptText.lastIndexOf(forbiddenTerm);
  const selectionTo = selectionFrom + forbiddenTerm.length;
  const basePreflightProfile = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "config", "manuscript-preflight.json"),
      "utf8",
    ),
  ) as {
    schemaVersion: 1;
    defaults: Record<string, unknown>;
    limits: Record<string, unknown>;
  };
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_MANUSCRIPT_PREFLIGHT_PROFILE: JSON.stringify({
      ...basePreflightProfile,
      defaults: {
        ...basePreflightProfile.defaults,
        forbiddenTerms: [forbiddenTerm],
        forbiddenCaseSensitive: true,
      },
    }),
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
    await manuscript.press("Control+Home");
    for (let index = 0; index < selectionFrom; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < forbiddenTerm.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByLabel("기능 목적지").selectOption(
      destinationId,
    );
    await expect(permissionDialog.getByLabel("로컬 읽기"))
      .toHaveValue("selection");
    await expect(permissionDialog.getByLabel("외부 전송"))
      .toHaveValue("none");
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    await permissionDialog
      .getByRole("button", { name: "선택 표기 점검", exact: true })
      .click();

    let candidateLedger = permissionDialog.getByRole("region", {
      name: "표기 점검 결과",
    });
    const findingButtonName =
      `금칙어 · ${forbiddenTerm} ${selectionFrom}–${selectionTo}`;
    await expect(candidateLedger.getByText("1곳", { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByRole("button", {
      name: findingButtonName,
      exact: true,
    })).toBeVisible();
    const receiptLedger = permissionDialog.getByRole("region", {
      name: "조수 접근 기록",
    });
    await expect(receiptLedger.getByText(
      `읽기 ${forbiddenTerm.length.toLocaleString()}자 · 전송 0자`,
      { exact: true },
    )).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);

    await candidateLedger.getByRole("button", {
      name: findingButtonName,
      exact: true,
    }).click();
    await expect(permissionDialog).toBeHidden();
    await expect
      .poll(() =>
        page.locator(".manuscript-editor").evaluate((element) => ({
          anchor: Number(element.getAttribute("data-selection-anchor")),
          head: Number(element.getAttribute("data-selection-head")),
        })),
      )
      .toEqual({ anchor: selectionFrom, head: selectionTo });
    await expectEditorText(manuscript, manuscriptText);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    permissionDialog = await openAssistantContext(page);
    candidateLedger = permissionDialog.getByRole("region", {
      name: "표기 점검 결과",
    });
    await expect(candidateLedger.getByRole("button", {
      name: findingButtonName,
      exact: true,
    })).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("persists assistant connections without returning or writing plaintext credentials", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-connections-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const connectionLabel = `connection-${randomUUID()}`;
  const updatedLabel = `updated-${randomUUID()}`;
  const endpoint = `https://${randomUUID()}.invalid/rpc`;
  const model = `model-${randomUUID()}`;
  const credential = `credential-${randomUUID()}`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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

    await page.getByRole("button", { name: "조수", exact: true }).click();
    await page.getByRole("dialog", { name: "GPT 조수 대화", exact: true })
      .getByRole("button", { name: "원고 도구", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "조수 접근 권한" })
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    let connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption(
      "eum-structured-json-v1",
    );
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog
      .getByRole("textbox", { name: "자격 증명", exact: true })
      .fill(credential);
    await connectionDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(connectionLabel);
    await expect(
      connectionDialog.getByRole("textbox", {
        name: "자격 증명",
        exact: true,
      }),
    ).toHaveValue("");
    const rendererProjection = await page.evaluate(async () =>
      JSON.stringify(await window.eumStudio.assistant.listConnections()),
    );
    expect(rendererProjection).not.toContain(credential);
    expect(
      await readFile(path.join(connectionRoot, "connections.json"), "utf8"),
    ).not.toContain(credential);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await page.getByRole("button", { name: "조수", exact: true }).click();
    await page.getByRole("dialog", { name: "GPT 조수 대화", exact: true })
      .getByRole("button", { name: "원고 도구", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "조수 접근 권한" })
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await expect(connectionDialog.getByLabel("연결 종류")).toHaveValue(
      "eum-structured-json-v1",
    );
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(connectionLabel);
    await expect(connectionDialog.getByLabel("Endpoint")).toHaveValue(endpoint);
    await expect(connectionDialog.getByLabel("Model")).toHaveValue(model);
    await expect(
      connectionDialog.getByRole("textbox", {
        name: "자격 증명",
        exact: true,
      }),
    ).toHaveValue("");
    await connectionDialog.getByLabel("연결 이름").fill(updatedLabel);
    await connectionDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(updatedLabel);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await page.getByRole("button", { name: "조수", exact: true }).click();
    await page.getByRole("dialog", { name: "GPT 조수 대화", exact: true })
      .getByRole("button", { name: "원고 도구", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "조수 접근 권한" })
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 저장됨/u }),
    ).toContainText(updatedLabel);
    await connectionDialog
      .getByRole("button", { name: "삭제", exact: true })
      .click();
    await expect(connectionDialog.getByText("저장된 연결이 없습니다."))
      .toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(async () =>
          (await window.eumStudio.assistant.listConnections()).connections.length,
        ),
      )
      .toBe(0);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("sends only an approved exact selection to a user connector and reopens the vocabulary suggestion Candidate", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-vocabulary-suggestion-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const connectionLabel = `connection-${randomUUID()}`;
  const model = `model-${randomUUID()}`;
  const query = `query-${randomUUID()}`;
  const selectedText = `selection-${randomUUID()}`;
  const manuscriptText = `outside-${randomUUID()} ${selectedText} tail-${randomUUID()}`;
  const suggestionWord = `suggestion-${randomUUID()}`;
  const suggestionNuance = `nuance-${randomUUID()}`;
  const suggestionExample = `example-${randomUUID()}`;
  const suggestionNote = `note-${randomUUID()}`;
  const receivedRequests: Array<{
    readonly method: string | undefined;
    readonly url: string | undefined;
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly body: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      receivedRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        schemaVersion: 1,
        payload: {
          suggestions: [{
            word: suggestionWord,
            nuance: suggestionNuance,
            example: suggestionExample,
          }],
          note: suggestionNote,
        },
      }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const serverAddress = server.address();
  if (serverAddress === null || typeof serverAddress === "string") {
    throw new Error("Expected a local connector TCP address");
  }
  const endpoint = `http://127.0.0.1:${serverAddress.port}/assistant`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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
    const selectionFrom = manuscriptText.indexOf(selectedText);
    const selectionTo = selectionFrom + selectedText.length;
    await manuscript.press("Control+Home");
    for (let index = 0; index < selectionFrom; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < selectedText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog
      .getByRole("button", { name: "연결 설정", exact: true })
      .click();
    const connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption(
      "eum-structured-json-v1",
    );
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(
      connectionDialog.getByRole("button", { name: /자격 증명 없음/u }),
    ).toContainText(connectionLabel);
    await connectionDialog
      .getByRole("button", { name: "닫기", exact: true })
      .click();

    permissionDialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await expect(permissionDialog).toBeVisible();
    await permissionDialog.getByLabel("어휘 제안 연결").selectOption({
      label: `${connectionLabel} · ${model}`,
    });
    await permissionDialog.getByLabel("어휘 제안 질문").fill(query);
    await permissionDialog
      .getByLabel("현재 원고의 정확한 선택 범위 함께 보내기")
      .check();
    await permissionDialog
      .getByRole("button", { name: "선택 전송 권한 승인", exact: true })
      .click();
    await expect(
      permissionDialog.getByRole("button", { name: "제안 받기", exact: true }),
    ).toBeEnabled();
    await permissionDialog
      .getByRole("button", { name: "제안 받기", exact: true })
      .click();

    const candidateLedger = permissionDialog.getByRole("region", {
      name: "어휘·유의어 제안 결과",
    });
    await expect(candidateLedger.getByText(suggestionWord, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(suggestionNuance, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(suggestionExample, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(suggestionNote, { exact: true }))
      .toBeVisible();
    await expect(candidateLedger.getByText(
      `${documentTitle} ${selectionFrom}–${selectionTo}`,
      { exact: false },
    )).toBeVisible();
    const receiptLedger = permissionDialog.getByRole("region", {
      name: "조수 접근 기록",
    });
    await expect(receiptLedger.getByText(
      `읽기 ${selectedText.length.toLocaleString()}자 · 전송 ${selectedText.length.toLocaleString()}자`,
      { exact: true },
    )).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
    await expect.poll(() => receivedRequests.length).toBe(1);
    expect(receivedRequests[0]).toMatchObject({
      method: "POST",
      url: "/assistant",
      body: {
        schemaVersion: 1,
        operation: "vocabulary-suggestions",
        model,
        input: { query, context: selectedText },
      },
    });
    expect(receivedRequests[0]?.headers.authorization).toBeUndefined();
    expect(JSON.stringify(receivedRequests[0]?.body)).not.toContain(
      manuscriptText.slice(0, selectionFrom),
    );
    expect(JSON.stringify(receivedRequests[0]?.body)).not.toContain(
      manuscriptText.slice(selectionTo),
    );

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    permissionDialog = await openAssistantContext(page);
    const reopenedCandidateLedger = permissionDialog.getByRole("region", {
      name: "어휘·유의어 제안 결과",
    });
    await expect(
      reopenedCandidateLedger.getByText(suggestionWord, { exact: true }),
    ).toBeVisible();
    await expect(
      reopenedCandidateLedger.getByText(connectionLabel, { exact: false }),
    ).toBeVisible();
    await expectEditorText(manuscript, manuscriptText);
    expect(receivedRequests).toHaveLength(1);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("sends only the approved current chapter and current Work settings to a user connector and reopens read-only setting proposals", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-external-setting-review-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const workTitle = randomUUID();
  const firstDocumentTitle = `현재-${randomUUID()}`;
  const secondDocumentTitle = `제외-${randomUUID()}`;
  const connectionLabel = `setting-connection-${randomUUID()}`;
  const model = `setting-model-${randomUUID()}`;
  const query = `setting-query-${randomUUID()}`;
  const characterName = `해린-${randomUUID()}`;
  const originalRole = `항해사-${randomUUID()}`;
  const proposedRole = `왕실 항해사-${randomUUID()}`;
  const firstManuscript = `${characterName}은 왕실 항해사로 불렸다. ${randomUUID()}`;
  const excludedManuscript = `다른 회차 비밀 ${randomUUID()}`;
  const replyText = `검토 응답 ${randomUUID()}`;
  const reviewNote = `역할 충돌 ${randomUUID()}`;
  const evidenceFrom = firstManuscript.indexOf(characterName);
  const evidenceTo = evidenceFrom + characterName.length;
  const receivedRequests: Array<{
    readonly method: string | undefined;
    readonly url: string | undefined;
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly body: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        schemaVersion: 1;
        operation: string;
        model: string;
        input: {
          query: string;
          manuscript: {
            documentId: string;
            documentRevisionId: string;
            from: number;
            to: number;
            text: string;
          };
          settings: Array<{
            kind: "character" | "plot" | "foreshadow";
            entityId: string;
            revision: number;
            label: string;
            fields: Array<{ field: string; value: string }>;
          }>;
        };
      };
      receivedRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
      });
      const character = body.input.settings.find((setting) =>
        setting.kind === "character" && setting.label === characterName
      );
      if (character === undefined) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "missing character" }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        schemaVersion: 1,
        payload: {
          reply: replyText,
          proposals: [{
            action: "update",
            settingKind: "character",
            target: {
              kind: character.kind,
              entityId: character.entityId,
              revision: character.revision,
            },
            label: character.label,
            field: "role",
            value: proposedRole,
            evidenceRange: {
              documentId: body.input.manuscript.documentId,
              documentRevisionId: body.input.manuscript.documentRevisionId,
              from: evidenceFrom,
              to: evidenceTo,
            },
            certainty: "explicit",
          }],
          reviewNotes: [{
            kind: "conflict",
            message: reviewNote,
            references: [{
              kind: character.kind,
              entityId: character.entityId,
              revision: character.revision,
            }],
          }],
        },
      }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const serverAddress = server.address();
  if (serverAddress === null || typeof serverAddress === "string") {
    throw new Error("Expected a local connector TCP address");
  }
  const endpoint = `http://127.0.0.1:${serverAddress.port}/assistant`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(firstManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStructureTab(page, "인물");
    let characterDialog = page.getByRole("region", { name: "인물 구조" });
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(characterName);
    await characterDialog.getByLabel("인물 역할").fill(originalRole);
    await characterDialog.getByRole("button", { name: "인물 만들기", exact: true }).click();
    await openWorkSection(page, "쓰기");
    await createNamedEpisode(page, secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    await expect(page.getByTestId("manuscript-character-count")).toHaveText(
      "0",
    );
    await manuscript.click();
    await manuscript.pressSequentially(excludedManuscript);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page.getByRole("button", { name: firstDocumentTitle, exact: true }).first().click();
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, firstManuscript);

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByRole("button", { name: "연결 설정", exact: true }).click();
    const connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption("eum-structured-json-v1");
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(connectionDialog.getByRole("button", { name: /자격 증명 없음/u }))
      .toContainText(connectionLabel);
    await connectionDialog.getByRole("button", { name: "닫기", exact: true }).click();

    permissionDialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await permissionDialog.getByLabel("외부 설정 검토 연결").selectOption({
      label: `${connectionLabel} · ${model}`,
    });
    await permissionDialog.getByLabel("외부 설정 검토 질문").fill(query);
    await permissionDialog
      .getByRole("button", { name: "회차·설정 전송 권한 승인", exact: true })
      .click();
    await expect(
      permissionDialog.getByRole("button", { name: "외부 검토 받기", exact: true }),
    ).toBeEnabled();
    await permissionDialog
      .getByRole("button", { name: "외부 검토 받기", exact: true })
      .click();

    const candidateLedger = permissionDialog.getByRole("region", {
      name: "외부 설정 검토 결과",
    });
    await expect(candidateLedger.getByText(proposedRole, { exact: false })).toBeVisible();
    await expect(candidateLedger.getByText(replyText, { exact: true })).toBeVisible();
    await expect(candidateLedger.getByText(reviewNote, { exact: true })).toBeVisible();
    await expect(candidateLedger.getByText("설정 전송 1개", { exact: false })).toBeVisible();
    await expect(candidateLedger.getByRole("button", {
      name: `원고 근거 ${evidenceFrom}–${evidenceTo} 열기`,
      exact: true,
    })).toBeVisible();
    await expectEditorText(manuscript, firstManuscript);
    await expect.poll(() => receivedRequests.length).toBe(1);
    expect(receivedRequests[0]).toMatchObject({
      method: "POST",
      url: "/assistant",
      body: {
        schemaVersion: 1,
        operation: "setting-review",
        model,
        input: {
          query,
          manuscript: {
            from: 0,
            to: firstManuscript.length,
            text: firstManuscript,
          },
          settings: [{
            kind: "character",
            label: characterName,
            fields: expect.arrayContaining([
              { field: "role", value: originalRole },
            ]),
          }],
        },
      },
    });
    expect(receivedRequests[0]?.headers.authorization).toBeUndefined();
    expect(JSON.stringify(receivedRequests[0]?.body)).not.toContain(excludedManuscript);

    await candidateLedger.getByRole("button", {
      name: /검토 당시 인물 r1 열기/u,
    }).click();
    characterDialog = page.getByRole("region", { name: "인물 구조" });
    await expect(characterDialog.getByLabel("인물 역할")).toHaveValue(originalRole);
    await openWorkSection(page, "쓰기");
    await expectEditorText(manuscript, firstManuscript);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, firstManuscript);
    permissionDialog = await openAssistantContext(page);
    const reopenedCandidateLedger = permissionDialog.getByRole("region", {
      name: "외부 설정 검토 결과",
    });
    await expect(reopenedCandidateLedger.getByText(proposedRole, { exact: false }))
      .toBeVisible();
    await expect(reopenedCandidateLedger.getByText(connectionLabel, { exact: false }))
      .toBeVisible();
    await expectEditorText(manuscript, firstManuscript);
    expect(receivedRequests).toHaveLength(1);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens and persists exact duplicate and field conflict setting references without changing settings", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-assistant-setting-review-"),
  );
  const workTitle = randomUUID();
  const documentTitle = randomUUID();
  const duplicateName = `해린-${randomUUID()}`;
  const duplicatePlotTitle = `푸른 문-${randomUUID()}`;
  const duplicateForeshadowTitle = `돌아올 약속-${randomUUID()}`;
  const characterRoles = ["첫 인물", "두 번째 인물"] as const;
  const plotStages = ["초반", "후반"] as const;
  const foreshadowNotes = ["첫 메모", "두 번째 메모"] as const;
  const destinationId = "local-exact-setting-review";
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

    await openStructureTab(page, "인물");
    let characterDialog = page.getByRole("region", { name: "인물 구조" });
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(duplicateName);
    await characterDialog.getByLabel("인물 역할").fill(characterRoles[0]);
    await characterDialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await characterDialog
      .getByRole("button", { name: "인물 추가", exact: true })
      .click();
    await characterDialog.getByLabel("인물 이름", { exact: true }).fill(duplicateName);
    await characterDialog.getByLabel("인물 역할").fill(characterRoles[1]);
    await characterDialog
      .getByRole("button", { name: "인물 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("플롯 제목").fill(duplicatePlotTitle);
    await plotDialog.getByLabel("플롯 단계").fill(plotStages[0]);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "새 플롯", exact: true })
      .click();
    await plotDialog.getByLabel("플롯 제목").fill(duplicatePlotTitle);
    await plotDialog.getByLabel("플롯 단계").fill(plotStages[1]);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await openStructureTab(page, "복선");
    let foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    const createForeshadowRegion = foreshadowDialog.locator(
      ".foreshadow-line-create",
    );
    await createForeshadowRegion.getByLabel("새 복선 이름")
      .fill(duplicateForeshadowTitle);
    await createForeshadowRegion.getByLabel("작가 메모")
      .fill(foreshadowNotes[0]);
    await createForeshadowRegion
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    await createForeshadowRegion.getByLabel("새 복선 이름")
      .fill(duplicateForeshadowTitle);
    await createForeshadowRegion.getByLabel("작가 메모")
      .fill(foreshadowNotes[1]);
    await createForeshadowRegion
      .getByRole("button", { name: "라인 만들기", exact: true })
      .click();
    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByLabel("기능 목적지").selectOption(
      destinationId,
    );
    await expect(
      permissionDialog.getByRole("combobox", { name: "기능", exact: true }),
    ).toHaveValue("lore-review");
    await permissionDialog.getByLabel("기간").selectOption("work");
    await permissionDialog
      .getByRole("button", { name: "권한 승인", exact: true })
      .click();
    await permissionDialog
      .getByRole("button", { name: "설정 검토", exact: true })
      .click();
    const findingLedger = permissionDialog.getByRole("region", {
      name: "설정 검토 결과",
    });
    await expect(findingLedger.getByText(`“${duplicateName}”`, { exact: true }))
      .toHaveCount(2);
    await expect(
      findingLedger.getByText(`“${duplicatePlotTitle}”`, { exact: true }),
    ).toHaveCount(2);
    await expect(
      findingLedger.getByText(`“${duplicateForeshadowTitle}”`, { exact: true }),
    ).toHaveCount(2);
    await expect(findingLedger.getByText("2개", { exact: true })).toHaveCount(6);
    await expect(
      findingLedger.getByText("인물 안의 역할 값이 서로 다름", { exact: true }),
    ).toBeVisible();
    await expect(
      findingLedger.getByText("플롯 안의 단계 값이 서로 다름", { exact: true }),
    ).toBeVisible();
    await expect(
      findingLedger.getByText("복선 안의 메모 값이 서로 다름", { exact: true }),
    ).toBeVisible();
    const settingReceiptLedger = permissionDialog.getByRole("region", {
      name: "설정 검토 접근 기록",
    });
    await expect(
      settingReceiptLedger.getByText("읽기 6개 · 외부 전송 0개", {
        exact: true,
      }),
    ).toBeVisible();

    const reopenPermissionDialog = async () => {
      return openAssistantContext(page);
    };

    const openedCharacterRoles: string[] = [];
    for (let index = 1; index <= 2; index += 1) {
      await permissionDialog.getByRole("button", {
        name: `“${duplicateName}” 역할 충돌 인물 ${index} 열기`,
        exact: true,
      }).click();
      characterDialog = page.getByRole("region", { name: "인물 구조" });
      openedCharacterRoles.push(
        await characterDialog.getByLabel("인물 역할").inputValue(),
      );
      if (index < 2) permissionDialog = await reopenPermissionDialog();
    }
    expect(openedCharacterRoles.sort()).toEqual([...characterRoles].sort());

    permissionDialog = await reopenPermissionDialog();
    const openedPlotStages: string[] = [];
    for (let index = 1; index <= 2; index += 1) {
      await permissionDialog.getByRole("button", {
        name: `“${duplicatePlotTitle}” 단계 충돌 플롯 ${index} 열기`,
        exact: true,
      }).click();
      plotDialog = page.getByRole("region", { name: "플롯 작업면" });
      openedPlotStages.push(
        await plotDialog.getByLabel("플롯 단계").inputValue(),
      );
      if (index < 2) permissionDialog = await reopenPermissionDialog();
    }
    expect(openedPlotStages.sort()).toEqual([...plotStages].sort());

    permissionDialog = await reopenPermissionDialog();
    const openedForeshadowNotes: string[] = [];
    for (let index = 1; index <= 2; index += 1) {
      await permissionDialog.getByRole("button", {
        name: `“${duplicateForeshadowTitle}” 메모 충돌 복선 ${index} 열기`,
        exact: true,
      }).click();
      foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
      const selectedLine = foreshadowDialog.locator(
        '.foreshadow-line-card[aria-current="true"]',
      );
      await expect(selectedLine).toHaveCount(1);
      openedForeshadowNotes.push(
        await selectedLine.getByLabel("복선 작가 메모").inputValue(),
      );
      if (index < 2) permissionDialog = await reopenPermissionDialog();
    }
    expect(openedForeshadowNotes.sort()).toEqual([...foreshadowNotes].sort());

    permissionDialog = await reopenPermissionDialog();

    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    const restoredCharacterProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      return window.eumStudio.characters.list({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(
      restoredCharacterProjection.characters.filter(
        (character) => character.name === duplicateName,
      ),
    ).toHaveLength(2);
    permissionDialog = await openAssistantContext(page);
    const reopenedFindingLedger = permissionDialog.getByRole("region", {
      name: "설정 검토 결과",
    });
    await expect(
      reopenedFindingLedger.getByText(`“${duplicateName}”`, { exact: true }),
    ).toHaveCount(2);
    await expect(
      reopenedFindingLedger.getByText(
        "인물 안의 역할 값이 서로 다름",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      permissionDialog
        .getByRole("region", { name: "설정 검토 접근 기록" })
        .getByText("읽기 6개 · 외부 전송 0개", { exact: true }),
    ).toBeVisible();
    await permissionDialog
      .getByRole("button", { name: "조수 접근 권한 닫기" })
      .click();
    await openStructureTab(page, "플롯");
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(
      plotDialog.locator(".plot-manager-list > ul > li").filter({
        hasText: duplicatePlotTitle,
      }),
    ).toHaveCount(2);
    const restoredPlotRows = plotDialog.locator(
      ".plot-manager-list > ul > li",
    );
    await expect(restoredPlotRows.filter({ hasText: plotStages[0] }))
      .toHaveCount(1);
    await expect(restoredPlotRows.filter({ hasText: plotStages[1] }))
      .toHaveCount(1);
    await openStructureTab(page, "복선");
    foreshadowDialog = page.getByRole("region", { name: "복선 라인" });
    expect(await foreshadowDialog
      .locator('input[aria-label="복선 이름"]')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLInputElement).value)
      ))
      .toEqual([duplicateForeshadowTitle, duplicateForeshadowTitle]);
    expect(await foreshadowDialog
      .locator('textarea[aria-label="복선 작가 메모"]')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLTextAreaElement).value).sort()
      ))
      .toEqual([...foreshadowNotes].sort());
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
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
    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    const firstDocumentButton = documentRail.getByRole("button", {
      name: firstDocument.label,
      exact: true,
    });
    const secondDocumentButton = documentRail.getByRole("button", {
      name: secondDocument.label,
      exact: true,
    });
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
    await window.locator(".focus-mode-toolbar-host").hover();
    const focusToolbar = window.getByRole("region", {
      name: "집중 화면 도구",
    });
    await focusToolbar
      .getByRole("button", { name: "타자기", exact: true })
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
    await window.locator(".focus-mode-toolbar-host").hover();
    await focusToolbar
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
    await expect(documentButtons).toHaveText(["제목없음"]);
    await expect(documentButtons.first()).toHaveAttribute("aria-current", "page");

    await window
      .getByRole("button", { name: "새 회차", exact: true })
      .click();

    await expect(documentButtons).toHaveText([
      "제목없음",
      "제목없음",
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
    await expect(window.locator(".manuscript-context")).toHaveText(
      renamedWorkTitle,
    );

    const documentRail = window.getByRole("complementary", {
      name: "문서 레일",
    });
    await documentRail
      .getByRole("button", { name: documentTitle, exact: true })
      .dblclick();
    const documentTitleInput = documentRail.getByRole("textbox", {
      name: "회차 제목",
      exact: true,
    });
    await expect(documentTitleInput).toHaveValue("");
    await documentTitleInput.press("Escape");
    await expect(documentTitleInput).toHaveCount(0);
    await expect(documentRail.getByRole("button", {
      name: documentTitle,
      exact: true,
    })).toBeVisible();
    await documentRail
      .getByRole("button", { name: documentTitle, exact: true })
      .dblclick();
    await expect(documentTitleInput).toHaveValue("");
    await window.getByTestId("manuscript-title").click();
    await expect(documentTitleInput).toHaveCount(0);
    await expect(documentRail.getByRole("button", {
      name: documentTitle,
      exact: true,
    })).toBeVisible();
    await documentRail
      .getByRole("button", { name: documentTitle, exact: true })
      .dblclick();
    await expect(documentTitleInput).toHaveValue("");
    await documentTitleInput.fill(renamedDocumentTitle);
    await documentTitleInput.press("Enter");
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      renamedDocumentTitle,
    );
    await expect(
      window
        .getByRole("complementary", { name: "문서 레일" })
        .locator(".document-tree-document .document-tree-open"),
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
    await expect(window.locator(".manuscript-context")).toHaveText(
      renamedWorkTitle,
    );
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
    const thirdDocumentButton = reorderRail.getByRole("button", {
      name: thirdDocumentTitle,
      exact: true,
    });
    const secondDocumentButton = reorderRail.getByRole("button", {
      name: secondDocumentTitle,
      exact: true,
    });
    await dragBetween(window, thirdDocumentButton, secondDocumentButton, 0.2);
    await expect(reorderRail.getByRole("region", { name: "회차 폴더" }))
      .toHaveAttribute("data-document-drag-active", "true");
    await expect(secondDocumentButton.locator("xpath=.."))
      .toHaveClass(/is-document-drop-before/u);
    await window.mouse.up();
    await expect(reorderRail.locator(
      ".document-tree-document .document-tree-open",
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
      ".document-tree-document .document-tree-open",
    );
    await expect(documentButtons).toHaveText([
      firstDocumentTitle,
      thirdDocumentTitle,
      secondDocumentTitle,
    ]);
    await documentRail
      .getByRole("button", { name: thirdDocumentTitle, exact: true })
      .click();
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
        ".document-tree-document .document-tree-open",
      ),
    ).toHaveText([
      firstDocumentTitle,
      thirdDocumentTitle,
      secondDocumentTitle,
    ]);
    await reopenedDocumentRail
      .getByRole("button", { name: thirdDocumentTitle, exact: true })
      .click();
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

    const firstDocumentButton = folderRegion.getByRole("button", {
      name: firstDocumentTitle,
      exact: true,
    });
    await dragEpisode(window, firstDocumentButton, childFolderRow);
    await expect(childFolderRow).toHaveClass(/is-document-folder-drop-target/u);
    await window.mouse.up();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    await dragEpisode(
      window,
      folderRegion.getByRole("button", {
        name: secondDocumentTitle,
        exact: true,
      }),
      childFolderRow,
    );
    await window.mouse.up();
    let childFolderGroup = childFolderRow.locator("xpath=..");
    let childDocumentButtons = childFolderGroup.locator(
      ":scope > .document-tree-children > .document-tree-document .document-tree-open",
    );
    await expect(childDocumentButtons).toHaveText([
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
    await expect(childDocumentButtons).toHaveText([
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

    await folderRegion
      .getByRole("button", { name: firstDocumentTitle, exact: true })
      .click();
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
      ":scope > .document-tree-children > .document-tree-document .document-tree-open",
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
      ":scope > .document-tree-children > .document-tree-document .document-tree-open",
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
        .getByRole("button", { name: firstDocumentTitle, exact: true }),
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
        .getByRole("button", { name: thirdDocumentTitle, exact: true }),
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
    await expect(
      window.getByRole("button", {
        name: `${firstWorkTitle} 이어쓰기`,
        exact: true,
      }),
    ).toBeVisible();
    await window
      .getByRole("button", {
        name: `${firstWorkTitle} 이어쓰기`,
        exact: true,
      })
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
    await expect(window.getByText("모든 작품 (0)", { exact: true }))
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
    await expect(window.getByText("모든 작품 (0)", { exact: true }))
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
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await createNamedEpisode(window, secondDocumentTitle);
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = window.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(secondManuscript);
    await expect(window.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(window);
    await window
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    window.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain(secondDocumentTitle);
      expect(dialog.message()).toContain("원고와 기록은 복구를 위해 보존됩니다.");
      await dialog.accept();
    });
    await window
      .getByRole("button", {
        name: `${workTitle} ${secondDocumentTitle} 회차 삭제`,
        exact: true,
      })
      .click();
    await expect(
      window.getByRole("button", {
        name: `${workTitle} ${secondDocumentTitle} 회차 삭제`,
        exact: true,
      }),
    ).toHaveCount(0);
    await window
      .getByRole("button", { name: firstDocumentTitle, exact: true })
      .click();
    await expect(window.getByRole("textbox", { name: "원고" })).toHaveText(
      firstManuscript,
    );

    await openStudioHome(window);
    await window
      .getByRole("button", { name: `${workTitle} 작품 열기`, exact: true })
      .click();
    window.once("dialog", (dialog) => dialog.accept());
    await window
      .getByRole("button", {
        name: `${workTitle} ${firstDocumentTitle} 회차 삭제`,
        exact: true,
      })
      .click();
    const emptyWorkCard = window
      .locator("article.library-work-card")
      .filter({ hasText: workTitle });
    await expect(
      emptyWorkCard.getByText("0개 회차", { exact: false }),
    ).toBeVisible();
    await expect(
      window.getByRole("button", {
        name: `${workTitle} 이어쓰기`,
        exact: true,
      }),
    ).toBeVisible();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 900 });
    const reopenEmptyWorkButton = window.getByRole("button", {
      name: `${workTitle} 이어쓰기`,
      exact: true,
    });
    await expect(reopenEmptyWorkButton).toBeVisible();
    await reopenEmptyWorkButton.click();
    await expect(
      window.getByText("이 작품에는 회차가 없습니다.", { exact: true }),
    ).toBeVisible();
    await window
      .getByRole("button", { name: "새 회차", exact: true })
      .click();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      "제목없음",
    );
    await expect(window.getByRole("textbox", { name: "원고" })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
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
      .getByRole("button", { name: secondDocument.label, exact: true })
      .evaluate((button: HTMLElement) => button.click());
    expect(await readActiveDocumentId(window)).toBe(secondDocument.documentId);
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
      .getByRole("button", { name: secondDocument.label, exact: true })
      .evaluate((button: HTMLElement) => button.click());
    await documentTree
      .getByRole("button", { name: firstDocument.label, exact: true })
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
    expect(reviewRailLayout.actionWidth).toBeGreaterThan(
      reviewRailLayout.railWidth * 0.75,
    );
    await manuscript.click();
    await expect(manuscript).toBeFocused();
    await window.getByRole("button", { name: "검토 레일 닫기" }).focus();
    await window.keyboard.press("Enter");
    await expect(reviewRail).toBeHidden();
    await expect(manuscript).toBeVisible();

    await documentRail
      .getByRole("button", { name: secondDocument.label, exact: true })
      .click();
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

test("enters and exits the manuscript focus screen without hiding status", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-focus-screen-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("기존 원고");
  let electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
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
    const toolbar = window.getByRole("toolbar", {
      name: "원고 편집 도구",
    });

    await expect(documentRail).toBeVisible();
    await expect(toolbar).toBeVisible();
    const feedbackPanel = window.getByTestId("session-feedback");
    const feedbackDragHandle = window.getByRole("button", {
      name: "집중 세션 위치 이동",
      exact: true,
    });
    const feedbackHandleBounds = await feedbackDragHandle.boundingBox();
    if (feedbackHandleBounds === null) {
      throw new Error("The session feedback drag handle is missing");
    }
    await window.mouse.move(
      feedbackHandleBounds.x + feedbackHandleBounds.width / 2,
      feedbackHandleBounds.y + feedbackHandleBounds.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(240, 180, { steps: 4 });
    await window.mouse.up();
    await expect(feedbackPanel).toHaveClass(/is-moved/u);
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("eum_session_feedback_position")
    )).not.toBeNull();
    await window
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(window.locator(".sidebar")).toBeHidden();
    await expect(window.locator(".app-topbar")).toBeHidden();
    await expect(documentRail).toBeHidden();
    await expect(toolbar).toBeHidden();
    await expect(manuscript).toBeVisible();
    await expect(window.getByTestId("session-feedback")).toBeHidden();
    await expect(window.getByTestId("save-state")).toBeVisible();

    const focusToolbar = window.getByRole("region", {
      name: "집중 화면 도구",
    });
    await expect.poll(() => focusToolbar.evaluate((element) =>
      getComputedStyle(element).opacity
    )).toBe("0");
    await window.locator(".focus-mode-toolbar-host").hover();
    await expect.poll(() => focusToolbar.evaluate((element) =>
      getComputedStyle(element).opacity
    )).toBe("1");
    const focusDragHandle = window.getByRole("button", {
      name: "집중 화면 도구 위치 이동",
      exact: true,
    });
    const focusHandleBounds = await focusDragHandle.boundingBox();
    if (focusHandleBounds === null) {
      throw new Error("The focus toolbar drag handle is missing");
    }
    await window.mouse.move(
      focusHandleBounds.x + focusHandleBounds.width / 2,
      focusHandleBounds.y + focusHandleBounds.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(180, 120, { steps: 4 });
    await window.mouse.up();
    await expect(window.locator(".focus-mode-floating-surface"))
      .toHaveClass(/is-moved/u);
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("eum_focus_toolbar_position")
    )).not.toBeNull();
    const visibleSaveStatus = await window.getByTestId("save-state").innerText();
    await expect(focusToolbar).toContainText(visibleSaveStatus);

    const focusCanvas = window.locator(
      '.manuscript-editor-canvas[data-focus-presentation="true"]',
    );
    const widthControl = focusToolbar.getByLabel("집중 화면 원고 폭");
    await widthControl.focus();
    await widthControl.press("ArrowRight");
    await expect.poll(() => focusCanvas.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--focus-content-width").trim()
    )).toBe("705px");

    const manuscriptContent = manuscript;
    const initialFontSize = await manuscriptContent.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    );
    await focusToolbar.getByRole("button", {
      name: "집중 화면 확대",
      exact: true,
    }).click();
    await expect.poll(() => manuscriptContent.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )).toBeGreaterThan(initialFontSize);

    await focusToolbar.getByRole("button", {
      name: "현재 문단",
      exact: true,
    }).click();
    await expect(focusCanvas).toHaveAttribute("data-focus-current-block", "true");
    await focusToolbar.getByRole("button", {
      name: "타자기",
      exact: true,
    }).click();
    await expect(focusCanvas).toHaveAttribute("data-focus-typewriter", "true");
    const typewriterPosition = focusToolbar.getByLabel("타자기 위치", {
      exact: true,
    });
    await expect(typewriterPosition).toHaveValue("40");
    await typewriterPosition.fill("30");
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("eum_focus_typewriter_position_percent")
    )).toBe("30");
    await manuscript.click();
    await manuscript.press("Control+End");
    await window.keyboard.insertText("\n첫 줄\n둘째 줄\n셋째 줄");
    const readCursorEyeLineRatio = () =>
      window.locator(".manuscript-editor .cm-line.cm-activeLine").evaluate(
        (activeLine) => {
          const scroller = activeLine.closest<HTMLElement>(".cm-scroller");
          if (scroller === null) {
            throw new Error("The manuscript scroller is missing");
          }
          const cursorRect = activeLine.getBoundingClientRect();
          const scrollerRect = scroller.getBoundingClientRect();
          return (
            cursorRect.top + cursorRect.height / 2 - scrollerRect.top
          ) / scrollerRect.height;
        },
      );
    await expect.poll(async () => {
      const ratio = await readCursorEyeLineRatio();
      return ratio > 0.25 && ratio < 0.35;
    }).toBe(true);
    await window.keyboard.insertText("\n계속 입력");
    await expect.poll(async () => {
      const ratio = await readCursorEyeLineRatio();
      return ratio > 0.25 && ratio < 0.35;
    }).toBe(true);
    await window.locator(".focus-mode-toolbar-host").hover();
    await typewriterPosition.fill("65");
    await expect.poll(async () => {
      const ratio = await readCursorEyeLineRatio();
      return ratio > 0.6 && ratio < 0.7;
    }).toBe(true);

    const typewriterSelectionPoints = await window.locator(".cm-line").evaluateAll(
      (lines) => {
        const findLine = (text: string) => {
          const line = lines.find((candidate) => candidate.textContent === text);
          if (!(line instanceof HTMLElement) || !(line.firstChild instanceof Text)) {
            throw new Error(`Missing CodeMirror line: ${text}`);
          }
          return line.firstChild;
        };
        const pointAt = (textNode: Text, offset: number) => {
          const range = document.createRange();
          range.setStart(textNode, offset);
          range.setEnd(textNode, offset + 1);
          const rectangle = range.getBoundingClientRect();
          return {
            x: rectangle.left,
            y: rectangle.top + rectangle.height / 2,
          };
        };
        return {
          start: pointAt(findLine("첫 줄"), 0),
          end: pointAt(findLine("둘째 줄"), 2),
        };
      },
    );
    const scrollTopBeforePointerSelection = await manuscript.evaluate(
      (element) => element.closest<HTMLElement>(".cm-scroller")?.scrollTop ?? -1,
    );
    await window.mouse.move(
      typewriterSelectionPoints.start.x,
      typewriterSelectionPoints.start.y,
    );
    await window.mouse.down();
    await window.mouse.move(
      typewriterSelectionPoints.end.x,
      typewriterSelectionPoints.end.y,
      { steps: 4 },
    );
    await window.mouse.up();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? "")
    ).toBe("첫 줄\n둘째");
    const scrollTopAfterPointerSelection = await manuscript.evaluate(
      (element) => element.closest<HTMLElement>(".cm-scroller")?.scrollTop ?? -1,
    );
    expect(Math.abs(
      scrollTopAfterPointerSelection - scrollTopBeforePointerSelection,
    )).toBeLessThan(2);

    await window.keyboard.press("Escape");
    await expect(documentRail).toBeVisible();
    await expect(toolbar).toBeVisible();

    await window.keyboard.press("Escape");
    await expect(documentRail).toBeVisible();
    await window.keyboard.press("Control+Shift+Enter");
    await expect(documentRail).toBeHidden();
    await window.locator(".focus-mode-toolbar-host").hover();
    await window
      .getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();
    await expect(documentRail).toBeVisible();
    await expect(toolbar).toBeVisible();

    await electronApp.close();
    electronApp = await electron.launch({
      args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
      cwd: process.cwd(),
      env: {
        ...process.env,
        EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
          JSON.stringify(documentProfile),
        EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
      },
    });
    const reopened = await openStudioWorkspace(electronApp);
    await expect(reopened.getByTestId("session-feedback"))
      .toHaveClass(/is-moved/u);
    await reopened
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(reopened.locator(".focus-mode-floating-surface"))
      .toHaveClass(/is-moved/u);
    await reopened.locator(".focus-mode-toolbar-host").hover();
    const reopenedFocusToolbar = reopened.getByRole("region", {
      name: "집중 화면 도구",
    });
    await reopenedFocusToolbar
      .getByRole("button", { name: "타자기", exact: true })
      .click();
    await expect(
      reopenedFocusToolbar.getByLabel("타자기 위치", { exact: true }),
    ).toHaveValue("65");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("records focus-screen time in the WritingSession activity ledger", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-focus-time-ledger-"),
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

  const readFocusSession = () => {
    try {
      const database = new DatabaseSync(
        path.join(directory, "workspace.sqlite3"),
        { readOnly: true },
      );
      try {
        return database.prepare(`
          SELECT
            sessions.id,
            sessions.state,
            intervals.started_at AS startedAt,
            intervals.ended_at AS endedAt
          FROM writing_sessions AS sessions
          LEFT JOIN activity_intervals AS intervals
            ON intervals.session_id = sessions.id
          ORDER BY sessions.created_at DESC
          LIMIT 1
        `).get() as
          | {
              readonly id: string;
              readonly state: string;
              readonly startedAt: string | null;
              readonly endedAt: string | null;
            }
          | undefined;
      } finally {
        database.close();
      }
    } catch {
      return undefined;
    }
  };
  const readActiveSessionId = (page: Page) =>
    page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return null;
      const activity = await window.eumStudio.activity.listWork({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
      return activity.activeSessionId;
    });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
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

    await page
      .getByRole("button", { name: "집중 화면 시작", exact: true })
      .click();
    await expect(page.locator(".writing-workspace-focus-mode")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.locator(".activity-status-error").allTextContents())
      .toEqual([]);
    await expect.poll(() => readActiveSessionId(page)).not.toBeNull();
    await expect.poll(() => readFocusSession()?.state ?? null).toBe("active");
    await page.waitForTimeout(1_200);
    await page.keyboard.press("Escape");
    await expect(page.locator(".app-topbar")).toBeVisible();
    await expect.poll(() => readFocusSession()?.state ?? null).toBe("completed");
    const recorded = readFocusSession();
    expect(recorded?.startedAt).not.toBeNull();
    expect(recorded?.endedAt).not.toBeNull();
    expect(
      Date.parse(recorded?.endedAt ?? "") -
        Date.parse(recorded?.startedAt ?? ""),
    ).toBeGreaterThanOrEqual(1_000);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shows the home manuscript preview and protects only existing text during focused forward writing", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-forward-writing-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile(
    "기존  원고\n둘째 줄\t—기호!\n\n마지막 문장…",
  );
  const firstDocument = documentProfile.documents[0]!;
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1280, height: 800 });
    await expect(
      window.getByRole("heading", { name: "홈", exact: true }),
    ).toBeVisible();
    await expect.poll(() =>
      window
        .getByLabel("마지막 원고 미리보기", { exact: true })
        .locator(".resume-strip-preview-line")
        .evaluateAll((lines) => lines.map((line) => line.textContent ?? ""))
    ).toEqual(firstDocument.initialText.split("\n"));
    await continueFromMain(window);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expect(manuscript).toBeVisible();
    const readText = () =>
      manuscript.evaluate((editor) =>
        Array.from(editor.querySelectorAll(":scope > .cm-line"))
          .map((line) => line.textContent ?? "")
          .join("\n"),
      );
    await expect.poll(readText).toBe(firstDocument.initialText);

    await window.getByLabel("본문 글꼴", { exact: true }).selectOption("pretendard");
    await window.getByLabel("글자 크기", { exact: true }).selectOption("20");
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const formattingDialog = window.getByRole("dialog", {
      name: "추가 서식 도구",
    });
    await formattingDialog.getByLabel("행간", { exact: true }).selectOption("1.5");
    await formattingDialog.getByLabel("문단 간격", { exact: true }).selectOption("8");
    await formattingDialog.getByLabel("자간", { exact: true }).selectOption("0.02");
    await formattingDialog.getByLabel("본문 폭", { exact: true }).fill("640");
    await formattingDialog
      .getByRole("button", { name: "추가 서식 도구 닫기", exact: true })
      .click();
    await openStudioHome(window);
    const formattedPreview = window.getByLabel("마지막 원고 미리보기", {
      exact: true,
    });
    await expect(formattedPreview).toHaveCSS("font-family", /Pretendard/u);
    await expect(formattedPreview).toHaveCSS("font-size", "20px");
    await expect(formattedPreview).toHaveCSS("max-width", "640px");
    await expect(formattedPreview).toHaveAttribute("data-line-height", "1.5");
    await expect(formattedPreview).toHaveAttribute("data-paragraph-spacing", "8");
    await expect(formattedPreview).toHaveAttribute("data-letter-spacing", "0.02");
    await continueFromMain(window);
    await expect(manuscript).toBeVisible();

    await window
      .getByRole("button", { name: "수정금지 집필 시작", exact: true })
      .click();
    const dialog = window.getByRole("dialog", {
      name: "수정금지 집필 설정",
    });
    await expect(dialog.getByLabel("목표 글자 수")).toHaveValue("");
    await dialog.getByLabel("목표 글자 수").fill("4");
    await dialog.getByRole("button", { name: "시작", exact: true }).click();

    const writingWorkspace = window.locator(".writing-workspace");
    await expect(writingWorkspace).toHaveClass(/writing-workspace-focus-mode/u);
    await expect(writingWorkspace).toHaveClass(/writing-workspace-forward-writing/u);
    await expect(window.locator(".forward-writing-composer")).toHaveCount(0);
    await expect(window.locator(".session-feedback-panel")).toBeHidden();
    const focusStatus = window.getByLabel("현재 집중 상태", { exact: true });
    await expect(focusStatus).toBeVisible();
    await expect(focusStatus).toContainText("수정금지 집필");
    await expect(focusStatus).toContainText("목표까지 4자");
    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    await expect.poll(readText).toBe(firstDocument.initialText);

    await manuscript.press("Control+Home");
    await manuscript.pressSequentially("새");
    await expect.poll(readText).toBe(`새${firstDocument.initialText}`);
    await manuscript.press("Backspace");
    await expect.poll(readText).toBe(firstDocument.initialText);

    await manuscript.press("Control+End");
    await manuscript.pressSequentially("새 문단");
    await expect.poll(readText).toBe(`${firstDocument.initialText}새 문단`);
    await expect(focusStatus).toContainText("목표 달성 · 4자");

    await window.locator(".focus-mode-toolbar-host").hover();
    await window
      .getByRole("button", { name: "수정금지 종료", exact: true })
      .click();
    await expect(writingWorkspace).not.toHaveClass(/writing-workspace-focus-mode/u);
    await expect(writingWorkspace).not.toHaveClass(/writing-workspace-forward-writing/u);
    await manuscript.click();
    await manuscript.press("Control+Home");
    await manuscript.pressSequentially("추가");
    await expect.poll(readText).toBe(
      `추가${firstDocument.initialText}새 문단`,
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shows sentence and repeated-word heatmaps with manuscript analysis", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-analysis-e2e-"),
  );
  const manuscriptText = `${"별빛 ".repeat(6)}끝.\n${"가".repeat(81)}.`;
  const documentProfile = createDocumentSwitchProfile(manuscriptText);
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
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
    await expectEditorText(manuscript, manuscriptText);
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    const heatmap = window.getByLabel("히트맵", { exact: true });

    await heatmap.selectOption("sentence");
    await expect(
      window.locator(".manuscript-editor .cm-editor"),
    ).toHaveAttribute("data-heatmap-mode", "sentence");
    await expect(window.locator(".manuscript-heatmap-extreme")).toHaveCount(1);
    await heatmap.selectOption("word");
    await expect(
      window.locator(".manuscript-heatmap-word-dense"),
    ).toHaveCount(6);
    await expectEditorText(manuscript, manuscriptText);

    await window
      .getByRole("button", { name: "원고 분석", exact: true })
      .click();
    const dialog = window.getByRole("dialog", { name: "원고 분석" });
    await expect(dialog).toContainText("별빛");
    await expect(dialog).toContainText("문장 길이");
    await expect(dialog).toContainText("반복 어휘 밀도");
    await dialog
      .getByRole("button", { name: "원고 분석 닫기", exact: true })
      .click();
    await window
      .getByRole("button", { name: "원고 분석", exact: true })
      .click();
    const reopenedDialog = window.getByRole("dialog", { name: "원고 분석" });
    await expect(reopenedDialog).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(reopenedDialog).toBeHidden();
    await expectEditorText(manuscript, manuscriptText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses the bundled curved quotes and evolving bracket input profile", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-bundled-input-profile-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("");
  const runtimeEnvironment = { ...process.env };
  delete runtimeEnvironment.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE;
  delete runtimeEnvironment.EUM_STUDIO_MANUSCRIPT_INPUT_PROFILE_PATH;
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...runtimeEnvironment,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });

    await manuscript.pressSequentially("\"");
    await expectEditorText(manuscript, "“”");
    await manuscript.pressSequentially("인용");
    await manuscript.pressSequentially("\"");
    await expectEditorText(manuscript, "“인용”");

    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    await manuscript.pressSequentially("(");
    await expectEditorText(manuscript, "()");
    await manuscript.pressSequentially("(");
    await expectEditorText(manuscript, "【】");
    await manuscript.pressSequentially("(");
    await expectEditorText(manuscript, "〖〗");

    await manuscript.press("Control+A");
    await manuscript.press("Backspace");
    await manuscript.pressSequentially("...");
    await expectEditorText(manuscript, "⋯");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens manuscript search with Ctrl+F and replaces one or all matches", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-search-replace-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile(
    "고양이는 창가에 앉았다.\n고양이는 다시 창가를 보았다.",
  );
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expectEditorText(
      manuscript,
      "고양이는 창가에 앉았다.\n고양이는 다시 창가를 보았다.",
    );

    await manuscript.press("Control+f");
    const searchPanel = window.locator(".manuscript-editor .cm-search");
    await expect(searchPanel).toBeVisible();
    await searchPanel.getByLabel("검색", { exact: true }).fill("고양이");
    await searchPanel.getByLabel("바꾸기", { exact: true }).fill("강아지");
    await searchPanel.getByRole("button", { name: "다음", exact: true })
      .click();
    await searchPanel.getByRole("button", { name: "바꾸기", exact: true })
      .click();
    await expectEditorText(
      manuscript,
      "강아지는 창가에 앉았다.\n고양이는 다시 창가를 보았다.",
    );
    await searchPanel.getByRole("button", {
      name: "모두 바꾸기",
      exact: true,
    }).click();
    await expectEditorText(
      manuscript,
      "강아지는 창가에 앉았다.\n강아지는 다시 창가를 보았다.",
    );
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the playlist entry on one top-bar row at the 150-percent CSS viewport", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-playlist-topbar-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("선곡목록 배율 확인");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    await page.setViewportSize({ width: 960, height: 720 });
    const topbar = page.locator(".app-topbar");
    const playlistEntry = page.getByRole("region", { name: "음악 플레이어" })
      .getByRole("button", {
        name: "선곡·재생목록 열기",
        exact: true,
      });
    await expect(playlistEntry).toBeVisible();
    const topbarBounds = await topbar.boundingBox();
    const playlistBounds = await playlistEntry.boundingBox();
    if (topbarBounds === null || playlistBounds === null) {
      throw new Error("Expected visible top bar and playlist entry bounds");
    }
    expect(playlistBounds.y).toBeGreaterThanOrEqual(topbarBounds.y);
    expect(playlistBounds.y + playlistBounds.height)
      .toBeLessThanOrEqual(topbarBounds.y + topbarBounds.height);
    await expect(playlistEntry).toHaveCSS("white-space", "nowrap");
    await playlistEntry.click();
    const musicDialog = page.getByRole("dialog", {
      name: "음악 선곡과 재생목록",
      exact: true,
    });
    await expect(musicDialog).toBeVisible();
    const backdrop = page.locator(".music-library-backdrop");
    const backdropBounds = await backdrop.boundingBox();
    if (backdropBounds === null) {
      throw new Error("Expected the music dialog backdrop bounds");
    }
    await page.mouse.click(backdropBounds.x + 2, backdropBounds.y + 2);
    await expect(musicDialog).toBeHidden();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("applies the active dark theme to every promoted IA surface", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-promoted-theme-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("새 작업면 테마 확인");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    await page.setViewportSize({ width: 960, height: 720 });
    await page.getByRole("button", { name: "테마 변경", exact: true }).hover();
    await page.getByRole("group", { name: "테마 선택" })
      .getByRole("button", { name: "노르딕", exact: true })
      .click();
    await expect(page.locator(".studio-app-shell"))
      .toHaveAttribute("data-starlight-theme", "nord-theme");

    const brightBySurface: Record<string, string[]> = {};
    const audit = async (label: string, surface: Locator): Promise<void> => {
      await expect(surface).toBeVisible();
      const bright = await surface.evaluate((root) => {
        const elements = [root, ...root.querySelectorAll<HTMLElement>("*")];
        return elements.flatMap((element) => {
          if (
            element instanceof SVGElement ||
            element instanceof HTMLImageElement
          ) {
            return [];
          }
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (
            rect.width < 4 ||
            rect.height < 4 ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          ) {
            return [];
          }
          const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/u
            .exec(style.backgroundColor);
          if (match === null || Number(match[4] ?? 1) < 0.9) return [];
          const red = Number(match[1]);
          const green = Number(match[2]);
          const blue = Number(match[3]);
          const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          if (luminance < 242) return [];
          const className = typeof element.className === "string"
            ? element.className.trim().replace(/\s+/gu, ".")
            : "";
          return [`${element.tagName.toLowerCase()}${className ? `.${className}` : ""}=${style.backgroundColor}`];
        }).slice(0, 80);
      });
      if (bright.length > 0) brightBySurface[label] = bright;
    };

    for (const tab of ["개요", "플롯", "사건", "장면", "인물", "복선", "별빛"] as const) {
      await openStructureTab(page, tab);
      await audit(
        `구조/${tab}`,
        page.getByRole("region", { name: "구조 작업면" }),
      );
    }
    for (const tab of ["집필 기록", "원고 점검", "후보 검토함", "버전"] as const) {
      await openReviewTab(page, tab);
      await audit(
        `검토/${tab}`,
        page.getByRole("region", { name: "검토 작업면" }),
      );
    }

    await openWorkSection(page, "운영");
    const operations = page.getByRole("region", { name: "작품 운영 작업면" });
    await audit("운영", operations);
    await operations.getByRole("button", { name: /^투고/u }).click();
    const publishing = page.getByRole("dialog", { name: "투고" });
    await audit("운영/투고", publishing);
    await publishing.getByRole("button", {
      name: "투고 운영 닫기",
      exact: true,
    }).click();

    await openWorkSection(page, "쓰기");
    await openSchedule(page);
    const schedule = page.getByRole("dialog", { name: "작업 일정" });
    await audit("일정", schedule);
    await schedule.getByRole("button", { name: "일정", exact: true }).click();
    const scheduleItem = page.getByRole("dialog", { name: "일정 추가" });
    await audit("일정/추가", scheduleItem);
    await scheduleItem.getByRole("button", {
      name: "일정 추가 닫기",
      exact: true,
    }).click();
    await schedule.getByRole("button", {
      name: "작업 일정 닫기",
      exact: true,
    }).click();

    await page.getByRole("button", {
      name: "작품 목록으로 돌아가기",
      exact: true,
    }).click();
    await audit("오늘", page.locator(".today-schedule-panel"));

    await page.getByRole("button", {
      name: "전체 일정 열기",
      exact: true,
    }).click();
    const todaySchedule = page.getByRole("dialog", { name: "작업 일정" });
    await expect(todaySchedule).toBeVisible();
    await todaySchedule.getByRole("button", { name: "일정", exact: true }).click();
    const nestedScheduleItem = page.getByRole("dialog", { name: "일정 추가" });
    await expect(nestedScheduleItem).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nestedScheduleItem).toBeHidden();
    await expect(todaySchedule).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(todaySchedule).toBeHidden();

    expect(brightBySurface).toEqual({});
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("selects and restores the exact 14-theme 별빛 서재 palette", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-dark-writing-e2e-"),
  );
  const documentProfile = createDocumentSwitchProfile("어두운 화면 원고");
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE: JSON.stringify(documentProfile),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let window = await openStudioWorkspace(electronApp);
    let shell = window.locator(".studio-app-shell");
    let editor = window.locator(".manuscript-editor .cm-scroller");
    let content = window.getByRole("textbox", { name: "원고" });

    await window
      .getByRole("button", { name: "테마 변경", exact: true })
      .hover();
    const themeDialog = window.getByRole("group", { name: "테마 선택" });
    await expect(themeDialog).toBeVisible();
    const themeButtons = themeDialog.locator(".starlight-theme-grid button");
    await expect(themeButtons).toHaveCount(14);
    await expect(themeButtons).toHaveText([
      /라이트/,
      /크림/,
      /세피아/,
      /소프트/,
      /뉴트럴/,
      /베이지/,
      /포커스L/,
      /다크/,
      /미드나잇/,
      /그레이/,
      /소프트D/,
      /웜다크/,
      /노르딕/,
      /포커스D/,
    ]);
    await themeDialog
      .getByRole("button", { name: "노르딕", exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-starlight-theme", "nord-theme");
    await expect(shell).toHaveCSS("background-color", "rgb(46, 52, 64)");
    await expect(editor).toHaveCSS("background-color", "rgb(46, 52, 64)");
    await expect(content).toHaveCSS("color", "rgb(236, 239, 244)");
    await expect.poll(() => window.evaluate(() =>
      window.localStorage.getItem("starlight_theme"),
    )).toBe("nord-theme");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await openStudioWorkspace(electronApp);
    shell = window.locator(".studio-app-shell");
    editor = window.locator(".manuscript-editor .cm-scroller");
    content = window.getByRole("textbox", { name: "원고" });
    await expect(shell).toHaveAttribute("data-starlight-theme", "nord-theme");
    await expect(editor).toHaveCSS("background-color", "rgb(46, 52, 64)");
    await expectEditorText(content, "어두운 화면 원고");

    await window
      .getByRole("button", { name: "밝은 화면 켜기", exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-starlight-theme", "light-mode");
    await expect(shell).toHaveCSS("background-color", "rgb(253, 252, 250)");
    await expect(editor).toHaveCSS("background-color", "rgb(253, 252, 250)");
    await expect(content).toHaveCSS("color", "rgb(26, 26, 26)");
    await expect(
      window.getByRole("button", { name: "어두운 화면 켜기", exact: true }),
    ).toBeVisible();

    await window
      .getByRole("button", { name: "어두운 화면 켜기", exact: true })
      .click();
    await expect(shell).toHaveAttribute("data-starlight-theme", "dark-mode");
    await expect(shell).toHaveCSS("background-color", "rgb(28, 28, 30)");
    await expect(editor).toHaveCSS("background-color", "rgb(28, 28, 30)");
    await expect(content).toHaveCSS("color", "rgb(245, 245, 247)");
    await expectEditorText(content, "어두운 화면 원고");

    await window.getByRole("button", { name: "테마 변경", exact: true }).hover();
    await window.getByRole("group", { name: "테마 선택" })
      .getByRole("button", { name: "포커스D", exact: true })
      .click();
    await expect(shell).toHaveAttribute(
      "data-starlight-theme",
      "focus-dark-theme",
    );
    await window.mouse.move(900, 700);
    const structureButton = window
      .getByRole("navigation", { name: "작품 작업면" })
      .getByRole("button", { name: "구조", exact: true });
    await structureButton.focus();
    await openStructureTab(window, "플롯");
    const plotWorkspace = window.getByRole("region", { name: "구조 작업면" });
    await expect(plotWorkspace).toBeVisible();
    expect(await plotWorkspace.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");
    await openStructureTab(window, "장면");
    expect(await plotWorkspace.locator(".work-subsection-panel").evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )).not.toBe("rgb(255, 255, 255)");

    await openStructureTab(window, "개요");
    const structureOverview = window.getByRole("region", {
      name: "작품 구조 개요",
      exact: true,
    });
    const structureCard = structureOverview.locator(".work-structure-panel").first();
    await expect(structureCard).toBeVisible();
    expect(await structureCard.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");
    expect(await structureOverview.locator(".work-structure-body").evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    )).toBe(true);

    await openStructureTab(window, "복선");
    const foreshadowContent = window.locator(".foreshadow-line-content");
    await expect(foreshadowContent).toBeVisible();
    expect(await foreshadowContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openStructureTab(window, "별빛");
    const loreContent = window.locator(".lore-manager-content");
    await expect(loreContent).toBeVisible();
    expect(await loreContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openReviewTab(window, "집필 기록");
    const recordsContent = window.locator(".records-content");
    await expect(recordsContent).toBeVisible();
    expect(await recordsContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openReviewTab(window, "후보 검토함");
    const loreCandidateContent = window.locator(".lore-candidate-content");
    await expect(loreCandidateContent).toBeVisible();
    expect(await loreCandidateContent.evaluate((element) =>
      getComputedStyle(element).backgroundColor
    )).not.toBe("rgb(255, 255, 255)");

    await openWorkSection(window, "쓰기");
    await expect(structureOverview).toBeHidden();
    await window.getByRole("button", {
      name: "집중 화면 시작",
      exact: true,
    }).click();
    const focusHost = window.locator(".focus-mode-toolbar-host");
    await expect(focusHost).toBeVisible();
    await focusHost.hover();
    const focusToolbar = window.getByRole("region", {
      name: "집중 화면 도구",
      exact: true,
    });
    await expect(focusToolbar).toBeVisible();
    await expect(focusToolbar).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await window.getByLabel("집중 화면 원고 폭", { exact: true }).fill("760");
    await window.getByRole("button", { name: "집중 화면 확대", exact: true })
      .click();
    await window.getByRole("button", { name: "현재 문단", exact: true }).click();
    await window.getByRole("button", { name: "타자기", exact: true }).click();
    await window.getByLabel("타자기 위치", { exact: true }).fill("30");
    await window.getByRole("button", { name: "집중 화면 종료", exact: true })
      .click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    window = await openStudioWorkspace(electronApp);
    shell = window.locator(".studio-app-shell");
    await expect(shell).toHaveAttribute(
      "data-starlight-theme",
      "focus-dark-theme",
    );
    await window.getByRole("button", {
      name: "집중 화면 시작",
      exact: true,
    }).click();
    await window.locator(".focus-mode-toolbar-host").hover();
    await expect(window.getByLabel("집중 화면 원고 폭", { exact: true }))
      .toHaveValue("760");
    await expect(window.getByRole("group", { name: "집중 화면 확대" }))
      .toContainText("110%");
    await expect(window.getByRole("button", { name: "현재 문단", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(window.getByRole("button", { name: "타자기", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(window.getByLabel("타자기 위치", { exact: true }))
      .toHaveValue("30");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("previews and applies a caller-selected UTF-8 manuscript text file", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-import-e2e-"),
  );
  const importPath = path.join(directory, "가져올 원고.txt");
  const importedText = "첫 줄\r\n둘째 줄\r셋째 줄";
  const normalizedText = "첫 줄\n둘째 줄\n셋째 줄";
  await writeFile(importPath, importedText, "utf8");
  const documentProfile = createDocumentSwitchProfile("기존 원고");
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE:
        JSON.stringify(documentProfile),
      EUM_STUDIO_MANUSCRIPT_TEXT_IMPORT_PATH: importPath,
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const window = await openStudioWorkspace(electronApp);
    const manuscript = window.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, "기존 원고");
    await window
      .getByRole("button", { name: "추가 서식 도구 열기", exact: true })
      .click();
    await window
      .getByRole("button", { name: "TXT 가져오기", exact: true })
      .click();

    const dialog = window.getByRole("dialog", { name: "원고 TXT 가져오기" });
    await expect(dialog).toContainText("가져올 원고.txt");
    await expect(dialog.getByRole("region", { name: "가져올 원고 미리보기" }))
      .toContainText("첫 줄\n둘째 줄\n셋째 줄");
    await expect(dialog).not.toContainText(directory);
    await expectEditorText(manuscript, "기존 원고");

    await dialog
      .getByRole("button", { name: "현재 원고 교체", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expectEditorText(manuscript, normalizedText);
    await manuscript.press("Control+Z");
    await expectEditorText(manuscript, "기존 원고");
    await manuscript.press("Control+Y");
    await expectEditorText(manuscript, normalizedText);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the single sidebar manually collapsed across viewport changes", async () => {
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

    await expect(documentRail).toBeVisible();
    await expect(reviewRail).toBeHidden();
    await window
      .getByRole("button", { name: "사이드바 접기" })
      .click();
    await expect(documentRail).toBeHidden();
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
    await expect(documentRail).toBeHidden();
    await expect(reviewRail).toBeHidden();
    await expect(
      window.getByRole("button", { name: "사이드바 펼치기" }),
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
    await searchInput.fill(query);
    await window.getByRole("button", { name: "검색" }).click();
    await expect(window.getByTestId("search-result-summary")).toHaveText(
      "1개 문서 · 1개 일치",
    );
    let searchResults = window.getByRole("region", {
      name: "원고 검색 결과",
    });
    await expect(
      searchResults.getByRole("button", {
        name: firstMatchingDocument.label,
      }),
    ).toBeVisible();
    await expect(
      searchResults.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toHaveCount(0);

    await searchResults
      .getByRole("button", {
        name: firstMatchingDocument.label,
      })
      .click();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      firstMatchingDocument.label,
    );
    expect(await readActiveDocumentId(window)).toBe(
      firstMatchingDocument.documentId,
    );

    await openStudioHome(window);
    await window
      .getByRole("button", {
        name: `${foreignMatchingDocument.label} 이어쓰기`,
        exact: true,
      })
      .click();
    await expect(window.getByTestId("manuscript-title")).toHaveText(
      foreignMatchingDocument.label,
    );
    expect(await readActiveDocumentId(window)).toBe(
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
    searchResults = window.getByRole("region", {
      name: "원고 검색 결과",
    });
    await expect(
      searchResults.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toBeVisible();
    await expect(
      searchResults.getByRole("button", {
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
    searchResults = window.getByRole("region", {
      name: "원고 검색 결과",
    });
    await expect(
      searchResults.getByRole("button", {
        name: foreignMatchingDocument.label,
      }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test("creates and edits the shared publishing partner ledger across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-partners-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const parentName = `은하출판-${suffix}`;
  const partnerName = `별빛문고-${suffix}`;
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expectDialogFitsDesktop(dialog);
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();

    await dialog.getByLabel("투고처 이름").fill(parentName);
    await dialog.getByLabel("투고 방식").fill("이메일");
    await dialog.getByLabel("투고 링크").fill("https://publisher.example");
    await dialog.getByLabel("투고처 이메일").fill("contact@publisher.example");
    await dialog.getByLabel("투고처 장르").fill("장르소설");
    await dialog.getByLabel("투고 분량").fill("원고 3화");
    await dialog.getByLabel("투고처 우선순위").fill("검토 중");
    await dialog.getByLabel("투고처 메모").fill("공식 안내 확인");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(parentName);

    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("모 출판사").selectOption({ label: parentName });
    await dialog.getByLabel("투고 방식").fill("온라인 폼");
    await dialog
      .getByLabel("투고 링크")
      .fill("https://publisher.example/submission");
    await dialog.getByLabel("투고처 이메일").fill("story@publisher.example");
    await dialog.getByLabel("투고처 장르").fill("판타지\n로맨스");
    await dialog.getByLabel("투고 분량").fill("시놉시스와 원고 3화");
    await dialog.getByLabel("투고처 우선순위").fill("이번 달");
    await dialog.getByLabel("투고처 메모").fill("마감일 확인");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(parentName);

    await dialog.getByLabel("투고처 이메일").fill("novel@publisher.example");
    await dialog.getByLabel("투고처 메모").fill("담당 메일 갱신");
    await dialog.getByRole("button", { name: "변경 저장", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이메일"))
      .toHaveValue("novel@publisher.example");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 800 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();

    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(parentName);
    await expect(dialog.getByLabel("투고 방식")).toHaveValue("온라인 폼");
    await expect(dialog.getByLabel("투고 링크"))
      .toHaveValue("https://publisher.example/submission");
    await expect(dialog.getByLabel("투고처 이메일"))
      .toHaveValue("novel@publisher.example");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지\n로맨스");
    await expect(dialog.getByLabel("투고 분량"))
      .toHaveValue("시놉시스와 원고 3화");
    await expect(dialog.getByLabel("투고처 우선순위")).toHaveValue("이번 달");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("담당 메일 갱신");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("compares user-entered web research and persists only explicitly selected partner fields", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-research-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const partnerName = `자료검토출판-${suffix}`;
  const sourceLabel = `공식투고안내-${suffix}`;
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
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("투고 방식").fill("이메일");
    await dialog.getByLabel("투고 링크").fill("https://old.example/submission");
    await dialog.getByLabel("투고처 이메일").fill("old@example.test");
    await dialog.getByLabel("투고처 장르").fill("판타지");
    await dialog.getByLabel("투고처 메모").fill("기존 메모");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "웹 자료 검토", exact: true }).click();
    await dialog.getByLabel("웹 자료 비교 투고처").selectOption({ label: partnerName });
    await dialog.getByLabel("자료 표시명").fill(sourceLabel);
    await dialog.getByLabel("자료 URL").fill("https://publisher.example/submissions");
    await dialog.getByLabel("확인한 날짜").fill("2026-08-10");
    await dialog.getByLabel("자료 권위").fill("공식 홈페이지");
    await dialog.getByLabel("홈페이지").fill("https://publisher.example/submit");
    await dialog.getByLabel("이메일").fill("new@example.test");
    await dialog.getByLabel("장르 (한 줄에 하나)").fill("판타지\n로맨스");
    await dialog.getByLabel("메모").fill("새 메모");
    await dialog.getByRole("button", { name: "현재 값과 비교", exact: true }).click();

    const candidate = dialog.getByRole("region", { name: "웹 자료 비교 결과" });
    await expect(candidate).toBeVisible();
    await candidate.getByLabel("홈페이지 반영").check();
    await candidate.getByLabel("장르 반영").check();
    await expect(candidate.getByLabel("이메일 반영")).not.toBeChecked();
    await expect(candidate.getByLabel("메모 반영")).not.toBeChecked();
    await candidate.getByRole("button", { name: "선택 필드 반영", exact: true }).click();
    await expect(candidate).toHaveCount(0);

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel("투고 링크"))
      .toHaveValue("https://publisher.example/submit");
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("old@example.test");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지\n로맨스");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("기존 메모");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
    await expect(dialog.getByLabel("근거 종류")).toHaveValue("web");
    await expect(dialog.getByLabel("근거 권위")).toHaveValue("공식 홈페이지");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);
    await expect(dialog.getByLabel("투고 링크"))
      .toHaveValue("https://publisher.example/submit");
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("old@example.test");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지\n로맨스");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("기존 메모");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("uses publishing metadata only and seals assistant record Candidates after explicit approval", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-assistant-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "assistant-connections");
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `조수투고작-${suffix}`;
  const documentTitle = `첫회차-${suffix}`;
  const firstPartnerName = `첫투고처-${suffix}`;
  const secondPartnerName = `둘째투고처-${suffix}`;
  const connectionLabel = `투고조수-${suffix}`;
  const model = `publishing-model-${suffix}`;
  const manuscriptText = `조수에게 전송되면 안 되는 원고 ${randomUUID()}`;
  const queryStatement = `${workTitle}를 아직 보내지 않은 곳을 보여줘`;
  const recordStatement = `2026-08-09에 ${workTitle}를 ${firstPartnerName}과 ${secondPartnerName}에 보냈어`;
  const receivedRequests: Array<{
    readonly method: string | undefined;
    readonly url: string | undefined;
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    readonly body: unknown;
  }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        readonly input: { readonly statement: string };
      };
      receivedRequests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        schemaVersion: 1,
        payload: body.input.statement === queryStatement
          ? {
              kind: "query-unsubmitted",
              workLabel: workTitle,
              partnerLabels: [],
              submittedOn: null,
            }
          : {
              kind: "record-submissions",
              workLabel: workTitle,
              partnerLabels: [firstPartnerName, secondPartnerName],
              submittedOn: "2026-08-09",
            },
      }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const serverAddress = server.address();
  if (serverAddress === null || typeof serverAddress === "string") {
    throw new Error("Expected a local publishing assistant TCP address");
  }
  const endpoint = `http://127.0.0.1:${serverAddress.port}/assistant`;
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: connectionRoot,
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    let permissionDialog = await openAssistantContext(page);
    await permissionDialog.getByRole("button", { name: "연결 설정", exact: true }).click();
    const connectionDialog = page.getByRole("dialog", { name: "조수 연결" });
    await connectionDialog.getByRole("button", {
      name: "새 연결",
      exact: true,
    }).first().click();
    await connectionDialog.getByLabel("연결 종류").selectOption("eum-structured-json-v1");
    await connectionDialog.getByLabel("연결 이름").fill(connectionLabel);
    await connectionDialog.getByLabel("Endpoint").fill(endpoint);
    await connectionDialog.getByLabel("Model").fill(model);
    await connectionDialog.getByRole("button", { name: "저장", exact: true }).click();
    await expect(connectionDialog.getByRole("button", { name: /자격 증명 없음/u }))
      .toContainText(connectionLabel);
    await connectionDialog.getByRole("button", { name: "조수 연결 닫기" }).click();
    permissionDialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await permissionDialog.getByRole("button", { name: "조수 접근 권한 닫기" }).click();

    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(firstPartnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(secondPartnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "작업실 조수", exact: true }).click();
    await dialog.getByLabel("투고 작업실 조수 연결").selectOption({
      label: `${connectionLabel} · ${model}`,
    });
    const assistantStatement = dialog.getByLabel("투고 작업실 조수 요청");
    await assistantStatement.fill(queryStatement);
    await dialog.getByRole("button", { name: "요청 해석", exact: true }).click();
    const queryResult = dialog.getByRole("region", { name: "작업실 조수 조회 결과" });
    await expect(queryResult.getByText(firstPartnerName, { exact: true })).toBeVisible();
    await expect(queryResult.getByText(secondPartnerName, { exact: true })).toBeVisible();
    expect((await page.evaluate(async () =>
      window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null })
    )).submissions).toHaveLength(0);

    await assistantStatement.fill(recordStatement);
    await dialog.getByRole("button", { name: "요청 해석", exact: true }).click();
    const candidate = dialog.getByRole("region", { name: "작업실 조수 기록 후보" });
    await expect(candidate.getByText(workTitle, { exact: true })).toBeVisible();
    await expect(candidate.getByText(firstPartnerName, { exact: true })).toBeVisible();
    await expect(candidate.getByText(secondPartnerName, { exact: true })).toBeVisible();
    expect((await page.evaluate(async () =>
      window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null })
    )).submissions).toHaveLength(0);
    await candidate.getByRole("button", { name: "확인하고 저장", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText(
      "투고 이력 2건을 현재 원고 버전으로 저장했습니다.",
    );

    const persisted = await page.evaluate(async () => {
      const [submissions, sources] = await Promise.all([
        window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null }),
        window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      ]);
      return { submissions: submissions.submissions, sources: sources.sources };
    });
    expect(persisted.submissions).toHaveLength(2);
    expect(persisted.sources).toHaveLength(1);
    expect(persisted.sources[0]).toMatchObject({
      kind: "user-statement",
      label: recordStatement,
    });
    expect(persisted.submissions.every((submission) =>
      submission.sourceIds[0] === persisted.sources[0]?.sourceId &&
      submission.package.documentRevisions.length === 1
    )).toBe(true);

    await expect.poll(() => receivedRequests.length).toBe(2);
    for (const request of receivedRequests) {
      expect(request).toMatchObject({
        method: "POST",
        url: "/assistant",
        body: {
          schemaVersion: 1,
          operation: "publishing-intent",
          model,
          input: {
            currentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
            registry: {
              currentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/u),
              works: [expect.objectContaining({ title: workTitle })],
              partners: expect.arrayContaining([
                expect.objectContaining({ name: firstPartnerName }),
                expect.objectContaining({ name: secondPartnerName }),
              ]),
              submissions: [],
            },
          },
        },
      });
      expect(request.headers.authorization).toBeUndefined();
      const serialized = JSON.stringify(request.body);
      expect(serialized).not.toContain(manuscriptText);
      expect(serialized).not.toContain("manuscript");
      expect(serialized).not.toContain("credential");
    }

    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();
    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    await expectEditorText(page.getByRole("textbox", { name: "원고" }), manuscriptText);
    const reopened = await page.evaluate(async () => {
      const [submissions, sources] = await Promise.all([
        window.eumStudio.publishingSubmissions.list({ schemaVersion: 1, workId: null }),
        window.eumStudio.publishingSources.list({ schemaVersion: 1 }),
      ]);
      return { submissions: submissions.submissions, sources: sources.sources };
    });
    expect(reopened).toEqual(persisted);
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    const submissionHistory = dialog.getByRole("region", { name: "투고 이력 목록" });
    await expect(submissionHistory.getByText(firstPartnerName, { exact: true })).toBeVisible();
    await expect(submissionHistory.getByText(secondPartnerName, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(recordStatement);
    expect(receivedRequests).toHaveLength(2);
  } finally {
    await electronApp.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error === undefined ? resolve() : reject(error));
    });
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("seals a submission package while history and manuscript continue independently across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-submissions-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `투고작-${suffix}`;
  const documentTitle = `첫회차-${suffix}`;
  const partnerName = `출판사-${suffix}`;
  const submissionTitle = `투고기록-${suffix}`;
  const initialText = `제출 원고 ${randomUUID()}`;
  const laterText = ` 이후 수정 ${randomUUID()}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(initialText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("투고 방식").fill("온라인 접수");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(partnerName);

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고 기록", exact: true }).click();
    await dialog.getByLabel("투고 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("투고처 선택").selectOption({ label: partnerName });
    await dialog.getByLabel("투고 기록 제목").fill(submissionTitle);
    await dialog.getByLabel("투고 상태").fill("접수");
    await dialog.getByLabel("투고일").fill("2026-08-10");
    await dialog.getByLabel("투고 메모").fill("접수 번호 보관");
    await dialog
      .getByRole("button", { name: "현재 원고 버전으로 기록 추가", exact: true })
      .click();
    const packageRegion = dialog.getByRole("region", {
      name: "제출 당시 원고 봉인본",
    });
    await expect(packageRegion).toContainText("1개 문서");
    const sealedManifest = await packageRegion.locator("small").textContent();
    expect(sealedManifest).not.toBeNull();
    expect(sealedManifest?.length).toBeGreaterThan(0);

    await dialog.getByLabel("투고 상태").fill("회신 완료");
    await dialog.getByLabel("회신일").fill("2026-08-18");
    await dialog.getByLabel("투고 결과").fill("수정 요청");
    await dialog.getByLabel("투고 카드 메모").fill("장르 편집부");
    await dialog.getByLabel("투고 메모").fill("회신 원문 별도 보관");
    await dialog.getByRole("button", { name: "투고 이력 저장", exact: true }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 완료");
    await expect(packageRegion.locator("small")).toHaveText(sealedManifest ?? "");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(laterText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 완료");
    await expect(dialog.getByLabel("투고 결과")).toHaveValue("수정 요청");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("회신 원문 별도 보관");
    await expect(
      dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"),
    ).toHaveText(sealedManifest ?? "");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await expect(dialog.getByLabel("투고 기록 제목")).toHaveValue(submissionTitle);
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 완료");
    await expect(dialog.getByLabel("회신일")).toHaveValue("2026-08-18");
    await expect(dialog.getByLabel("투고 결과")).toHaveValue("수정 요청");
    await expect(dialog.getByLabel("투고 카드 메모")).toHaveValue("장르 편집부");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("회신 원문 별도 보관");
    await expect(
      dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"),
    ).toHaveText(sealedManifest ?? "");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a contract linked to its matching submission across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-contracts-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `계약작-${suffix}`;
  const partnerName = `계약처-${suffix}`;
  const submissionTitle = `연결투고-${suffix}`;
  const contractTitle = `전자계약-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고 기록", exact: true }).click();
    await dialog.getByLabel("투고 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("투고처 선택").selectOption({ label: partnerName });
    await dialog.getByLabel("투고 기록 제목").fill(submissionTitle);
    await dialog
      .getByRole("button", { name: "현재 원고 버전으로 기록 추가", exact: true })
      .click();

    await dialog.getByRole("button", { name: "계약 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 계약", exact: true }).click();
    await dialog.getByLabel("계약 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("계약 거래처").selectOption({ label: partnerName });
    await dialog.getByLabel("계약 연결 투고").selectOption({ label: submissionTitle });
    await dialog.getByLabel("계약명").fill(contractTitle);
    await dialog.getByLabel("계약 상태").fill("체결");
    await dialog.getByLabel("계약 체결일").fill("2026-08-20");
    await dialog.getByLabel("계약 시작일").fill("2026-09-01");
    await dialog.getByLabel("계약 종료일").fill("2028-08-31");
    await dialog.getByLabel("계약 선급금").fill("1500000");
    await dialog.getByLabel("계약 통화").fill("KRW");
    await dialog.getByLabel("계약 권리 범위").fill("국내 전자 출판권");
    await dialog.getByLabel("계약 수익 배분 메모").fill("순매출 기준");
    await dialog.getByLabel("계약 메모").fill("원본 계약서는 별도 보관");
    await dialog.getByRole("button", { name: "계약 추가", exact: true }).click();
    await expect(dialog.getByLabel("계약명")).toHaveValue(contractTitle);
    await expect(dialog.getByRole("group", { name: "계약 소유 관계" }))
      .toContainText(submissionTitle);

    await dialog.getByLabel("계약 상태").fill("진행 중");
    await dialog.getByLabel("계약 체결일").fill("2026-08-21");
    await dialog.getByLabel("계약 종료일").fill("");
    await dialog.getByLabel("계약 선급금").fill("");
    await dialog.getByLabel("계약 권리 범위").fill("국내 전자·오디오 출판권");
    await dialog.getByLabel("계약 수익 배분 메모").fill("부속 합의 기준");
    await dialog.getByLabel("계약 메모").fill("부속 합의 확인");
    await dialog.getByRole("button", { name: "계약 변경 저장", exact: true }).click();
    await expect(dialog.getByLabel("계약 상태")).toHaveValue("진행 중");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "계약 원장", exact: true }).click();
    await expect(dialog.getByLabel("계약명")).toHaveValue(contractTitle);
    await expect(dialog.getByLabel("계약 상태")).toHaveValue("진행 중");
    await expect(dialog.getByLabel("계약 체결일")).toHaveValue("2026-08-21");
    await expect(dialog.getByLabel("계약 시작일")).toHaveValue("2026-09-01");
    await expect(dialog.getByLabel("계약 종료일")).toHaveValue("");
    await expect(dialog.getByLabel("계약 선급금")).toHaveValue("");
    await expect(dialog.getByLabel("계약 통화")).toHaveValue("KRW");
    await expect(dialog.getByLabel("계약 권리 범위"))
      .toHaveValue("국내 전자·오디오 출판권");
    await expect(dialog.getByLabel("계약 수익 배분 메모"))
      .toHaveValue("부속 합의 기준");
    await expect(dialog.getByLabel("계약 메모")).toHaveValue("부속 합의 확인");
    await expect(dialog.getByRole("group", { name: "계약 소유 관계" }))
      .toContainText(submissionTitle);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a publication with independent contract and channel links across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-publications-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `연재작-${suffix}`;
  const publisherName = `출판사-${suffix}`;
  const channelName = `연재관-${suffix}`;
  const contractTitle = `연재계약-${suffix}`;
  const publicationTitle = `주2회-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(publisherName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(channelName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "계약 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 계약", exact: true }).click();
    await dialog.getByLabel("계약 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("계약 거래처").selectOption({ label: publisherName });
    await dialog.getByLabel("계약명").fill(contractTitle);
    await dialog.getByRole("button", { name: "계약 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 발행·연재", exact: true }).click();
    await dialog.getByLabel("발행 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("발행 연결 계약").selectOption({ label: contractTitle });
    await dialog.getByLabel("발행 채널").selectOption({ label: channelName });
    await dialog.getByLabel("발행 단위 이름").fill(publicationTitle);
    await dialog.getByLabel("발행 상태").fill("연재 중");
    await dialog.getByLabel("발행 형태").fill("웹 연재");
    await dialog.getByLabel("발행 공개 예정일").fill("2026-09-01");
    await dialog.getByLabel("발행 시작일").fill("2026-09-03");
    await dialog.getByLabel("공개 단위 수").fill("12");
    await dialog.getByLabel("계획 단위 수").fill("40");
    await dialog.getByLabel("발행 일정 메모").fill("화·금 공개");
    await dialog.getByLabel("발행 메모").fill("채널 공지 확인");
    await dialog.getByRole("button", { name: "발행·연재 추가", exact: true }).click();
    await expect(dialog.getByLabel("발행 단위 이름")).toHaveValue(publicationTitle);
    await expect(dialog.getByLabel("발행 연결 계약").locator("option:checked"))
      .toHaveText(contractTitle);
    await expect(dialog.getByLabel("발행 채널").locator("option:checked"))
      .toHaveText(channelName);

    await dialog.getByLabel("발행 상태").fill("휴재");
    await dialog.getByLabel("발행 형태").fill("웹·앱 동시 연재");
    await dialog.getByLabel("발행 공개 예정일").fill("");
    await dialog.getByLabel("발행 시작일").fill("2026-09-04");
    await dialog.getByLabel("발행 종료일").fill("2026-12-31");
    await dialog.getByLabel("공개 단위 수").fill("13");
    await dialog.getByLabel("계획 단위 수").fill("");
    await dialog.getByLabel("발행 일정 메모").fill("복귀일 미정");
    await dialog.getByLabel("발행 메모").fill("13화까지 공개");
    await dialog
      .getByRole("button", { name: "발행·연재 변경 저장", exact: true })
      .click();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await expect(dialog.getByLabel("발행 단위 이름")).toHaveValue(publicationTitle);
    await expect(dialog.getByLabel("발행 연결 계약").locator("option:checked"))
      .toHaveText(contractTitle);
    await expect(dialog.getByLabel("발행 채널").locator("option:checked"))
      .toHaveText(channelName);
    await expect(dialog.getByLabel("발행 상태")).toHaveValue("휴재");
    await expect(dialog.getByLabel("발행 형태")).toHaveValue("웹·앱 동시 연재");
    await expect(dialog.getByLabel("발행 공개 예정일")).toHaveValue("");
    await expect(dialog.getByLabel("발행 시작일")).toHaveValue("2026-09-04");
    await expect(dialog.getByLabel("발행 종료일")).toHaveValue("2026-12-31");
    await expect(dialog.getByLabel("공개 단위 수")).toHaveValue("13");
    await expect(dialog.getByLabel("계획 단위 수")).toHaveValue("");
    await expect(dialog.getByLabel("발행 일정 메모")).toHaveValue("복귀일 미정");
    await expect(dialog.getByLabel("발행 메모")).toHaveValue("13화까지 공개");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a publication-owned settlement with signed line items across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-settlements-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `정산작-${suffix}`;
  const channelName = `정산채널-${suffix}`;
  const publicationTitle = `정산연재-${suffix}`;
  const settlementTitle = `9월정산-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(channelName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 발행·연재", exact: true }).click();
    await dialog.getByLabel("발행 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("발행 채널").selectOption({ label: channelName });
    await dialog.getByLabel("발행 단위 이름").fill(publicationTitle);
    await dialog.getByRole("button", { name: "발행·연재 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "정산서 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 정산서", exact: true }).click();
    await dialog.getByLabel("정산 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("정산 발행·연재").selectOption({ label: publicationTitle });
    await dialog.getByLabel("정산서 이름").fill(settlementTitle);
    await dialog.getByLabel("정산 기간 시작").fill("2026-09-01");
    await dialog.getByLabel("정산 기간 종료").fill("2026-09-30");
    await dialog.getByLabel("정산 발행일").fill("2026-10-10");
    await dialog.getByLabel("정산 검토 상태").fill("검토 중");
    await dialog.getByLabel("정산 보고 금액").fill("1250000");
    await dialog.getByLabel("정산 통화").fill("KRW");
    await dialog.getByLabel("정산 가감 항목명").fill("기본 배분");
    await dialog.getByLabel("정산 가감 금액").fill("1250000");
    await dialog.getByLabel("정산 가감 메모").fill("월 정산");
    await dialog.getByRole("button", { name: "항목 추가", exact: true }).click();
    await dialog.getByLabel("정산 메모").fill("원문 파일 별도 보관");
    await dialog.getByRole("button", { name: "정산서 추가", exact: true }).click();
    await expect(dialog.getByLabel("정산서 이름")).toHaveValue(settlementTitle);

    await dialog.getByLabel("정산 검토 상태").fill("확인 완료");
    await dialog.getByLabel("정산 발행일").fill("");
    await dialog.getByLabel("정산 보고 금액").fill("1240000");
    await dialog.getByLabel("정산 가감 항목명").fill("플랫폼 수수료 조정");
    await dialog.getByLabel("정산 가감 금액").fill("-10000");
    await dialog.getByLabel("정산 가감 메모").fill("명세서 반영");
    await dialog.getByRole("button", { name: "항목 추가", exact: true }).click();
    await dialog.getByLabel("정산 메모").fill("차액 확인 완료");
    await dialog.getByRole("button", { name: "정산서 변경 저장", exact: true }).click();
    const itemGroup = dialog.getByRole("group", { name: "가감 항목" });
    await expect(itemGroup).toContainText("기본 배분");
    await expect(itemGroup).toContainText("플랫폼 수수료 조정");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "정산서 원장", exact: true }).click();
    await expect(dialog.getByLabel("정산서 이름")).toHaveValue(settlementTitle);
    await expect(dialog.getByLabel("정산 발행·연재").locator("option:checked"))
      .toHaveText(publicationTitle);
    await expect(dialog.getByLabel("정산 검토 상태")).toHaveValue("확인 완료");
    await expect(dialog.getByLabel("정산 발행일")).toHaveValue("");
    await expect(dialog.getByLabel("정산 보고 금액")).toHaveValue("1240000");
    await expect(dialog.getByLabel("정산 통화")).toHaveValue("KRW");
    await expect(dialog.getByLabel("정산 메모")).toHaveValue("차액 확인 완료");
    const restoredItemGroup = dialog.getByRole("group", { name: "가감 항목" });
    await expect(restoredItemGroup).toContainText("기본 배분");
    await expect(restoredItemGroup).toContainText("1250000 KRW");
    await expect(restoredItemGroup).toContainText("플랫폼 수수료 조정");
    await expect(restoredItemGroup).toContainText("-10000 KRW");
    await expect(restoredItemGroup).toContainText("명세서 반영");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates and edits a settlement-linked payment with derived receivable across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-payments-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `입금작-${suffix}`;
  const channelName = `입금채널-${suffix}`;
  const publicationTitle = `입금연재-${suffix}`;
  const settlementTitle = `입금정산-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(channelName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "발행·연재 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 발행·연재", exact: true }).click();
    await dialog.getByLabel("발행 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("발행 채널").selectOption({ label: channelName });
    await dialog.getByLabel("발행 단위 이름").fill(publicationTitle);
    await dialog.getByRole("button", { name: "발행·연재 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "정산서 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 정산서", exact: true }).click();
    await dialog.getByLabel("정산 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("정산 발행·연재").selectOption({ label: publicationTitle });
    await dialog.getByLabel("정산서 이름").fill(settlementTitle);
    await dialog.getByLabel("정산 통화").fill("KRW");
    await dialog.getByLabel("정산 보고 금액").fill("1250000");
    await dialog.getByRole("button", { name: "정산서 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "입금 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 입금", exact: true }).click();
    await dialog.getByLabel("입금 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("입금 정산서").selectOption({ label: settlementTitle });
    await expect(dialog.getByLabel("입금 통화")).toHaveValue("KRW");
    await dialog.getByLabel("입금일").fill("2026-10-15");
    await dialog.getByLabel("입금액").fill("600000");
    await dialog.getByLabel("입금 매칭 상태").fill("부분 입금");
    await dialog.getByLabel("입금자").fill(channelName);
    await dialog.getByLabel("입금 거래 참조").fill("BANK-2026-10");
    await dialog.getByLabel("입금 메모").fill("1차 입금");
    await dialog.getByRole("button", { name: "입금 추가", exact: true }).click();
    const receivable = dialog.getByRole("region", { name: "미수금 요약" });
    await expect(receivable).toContainText("미수 650,000 KRW");
    await expect(receivable).toContainText("입금 600,000");

    await dialog.getByLabel("입금 확인일").fill("2026-10-16");
    await dialog.getByLabel("입금액").fill("590000");
    await dialog.getByLabel("입금 매칭 상태").fill("확인 완료");
    await dialog.getByLabel("입금자").fill("별빛 콘텐츠");
    await dialog.getByLabel("입금 거래 참조").fill("BANK-2026-10-R1");
    await dialog.getByLabel("입금 메모").fill("수수료 차감 확인");
    await dialog.getByRole("button", { name: "입금 변경 저장", exact: true }).click();
    await expect(receivable).toContainText("미수 660,000 KRW");
    await expect(receivable).toContainText("입금 590,000");
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "입금 원장", exact: true }).click();
    await expect(dialog.getByLabel("입금 정산서").locator("option:checked"))
      .toHaveText(settlementTitle);
    await expect(dialog.getByLabel("입금일")).toHaveValue("2026-10-15");
    await expect(dialog.getByLabel("입금 확인일")).toHaveValue("2026-10-16");
    await expect(dialog.getByLabel("입금액")).toHaveValue("590000");
    await expect(dialog.getByLabel("입금 통화")).toHaveValue("KRW");
    await expect(dialog.getByLabel("입금 매칭 상태")).toHaveValue("확인 완료");
    await expect(dialog.getByLabel("입금자")).toHaveValue("별빛 콘텐츠");
    await expect(dialog.getByLabel("입금 거래 참조")).toHaveValue("BANK-2026-10-R1");
    await expect(dialog.getByLabel("입금 메모")).toHaveValue("수수료 차감 확인");
    await expect(dialog.getByRole("region", { name: "미수금 요약" }))
      .toContainText("미수 660,000 KRW");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("creates an immutable shared publishing source across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-sources-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `근거작-${suffix}`;
  const sourceLabel = `계약서 확인-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 근거", exact: true }).click();
    await dialog.getByLabel("근거 종류").fill("사용자 진술");
    await dialog.getByLabel("근거 표시명").fill(sourceLabel);
    await dialog.getByLabel("근거 URL").fill("https://example.test/contracts/source");
    await dialog.getByLabel("근거 확인 시각").fill("2026-10-16T12:30");
    await dialog.getByLabel("근거 권위").fill("직접 확인");
    await dialog.getByRole("button", { name: "근거 추가", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
    await expect(dialog.getByLabel("근거 종류")).toHaveValue("사용자 진술");
    await expect(dialog.getByLabel("근거 권위")).toHaveValue("직접 확인");
    await expect(dialog.getByText("이 근거는 자동 수정하지 않습니다.")).toBeVisible();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByLabel("근거 표시명")).toHaveValue(sourceLabel);
    await expect(dialog.getByLabel("근거 종류")).toHaveValue("사용자 진술");
    await expect(dialog.getByLabel("근거 URL"))
      .toHaveValue("https://example.test/contracts/source");
    await expect(dialog.getByLabel("근거 확인 시각")).toHaveValue("2026-10-16T12:30");
    await expect(dialog.getByLabel("근거 권위")).toHaveValue("직접 확인");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("links and unlinks a shared publishing source by explicit user selection across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-evidence-links-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `근거연결작-${suffix}`;
  const partnerName = `근거투고처-${suffix}`;
  const sourceLabel = `공식안내-${suffix}`;
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 근거", exact: true }).click();
    await dialog.getByLabel("근거 종류").fill("공식 안내");
    await dialog.getByLabel("근거 표시명").fill(sourceLabel);
    await dialog.getByLabel("근거 권위").fill("직접 확인");
    await dialog.getByRole("button", { name: "근거 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    const evidenceCheckbox = dialog.getByLabel(`${sourceLabel} 근거 연결`);
    await expect(evidenceCheckbox).not.toBeChecked();
    await evidenceCheckbox.check();
    await dialog.getByRole("button", { name: "근거 연결 저장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).toBeChecked();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).toBeChecked();
    await dialog.getByLabel(`${sourceLabel} 근거 연결`).uncheck();
    await dialog.getByRole("button", { name: "근거 연결 저장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).not.toBeChecked();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel(`${sourceLabel} 근거 연결`)).not.toBeChecked();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("imports explicitly mapped publishing partner CSV rows only after preview approval", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-partner-csv-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `CSV작-${suffix}`;
  const existingName = `기존출판-${suffix}`;
  const childName = `신규문고-${suffix}`;
  const csvPath = path.join(directory, "투고처.csv");
  await writeFile(csvPath, [
    "이름,모출판사,이메일,장르,원시열",
    `${existingName},,new@example.test,판타지,기존행`,
    `${childName},${existingName},child@example.test,로맨스,신규행`,
    ",,missing@example.test,,문제행",
  ].join("\r\n"), "utf8");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
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
    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({ canceled: false, filePaths: [selectedPath] }),
        });
      },
      csvPath,
    );
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(existingName);
    await dialog.getByLabel("투고처 이메일").fill("old@example.test");
    await dialog.getByLabel("투고처 메모").fill("기존 메모 유지");
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "CSV 가져오기", exact: true }).click();
    await dialog.getByRole("button", { name: "CSV 파일 선택", exact: true }).click();
    await dialog.getByLabel("투고처 이름 CSV 열").selectOption({ label: "이름" });
    await dialog.getByLabel("모 출판사 CSV 열").selectOption({ label: "모출판사" });
    await dialog.getByLabel("이메일 CSV 열").selectOption({ label: "이메일" });
    await dialog.getByLabel("장르 CSV 열").selectOption({ label: "장르" });
    await dialog.getByRole("button", { name: "미리보기 만들기", exact: true }).click();
    const preview = dialog.getByRole("region", { name: "투고처 CSV 미리보기" });
    await expect(preview).toContainText("2개 반영 가능");
    await expect(preview).toContainText("1개 확인 필요");
    await preview.getByText("확인 필요한 행", { exact: true }).click();
    await expect(preview).toContainText("4행: 투고처 이름 없음");
    await preview.getByRole("button", { name: "2개 승인 반영", exact: true }).click();
    await expect(preview.getByRole("button", { name: "반영 완료", exact: true }))
      .toBeVisible();

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(existingName);
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("new@example.test");
    await expect(dialog.getByLabel("투고처 장르")).toHaveValue("판타지");
    await expect(dialog.getByLabel("투고처 메모")).toHaveValue("기존 메모 유지");
    await dialog.getByRole("button", { name: new RegExp(childName) }).click();
    await expect(dialog.getByLabel("투고처 이름")).toHaveValue(childName);
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(existingName);
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("child@example.test");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByText("투고처.csv · 2행", { exact: true })).toBeVisible();
    await expect(dialog.getByText("투고처.csv · 3행", { exact: true })).toBeVisible();
    await expect(dialog.getByText("투고처.csv · 4행", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(childName) }).click();
    await expect(dialog.getByLabel("모 출판사").locator("option:checked"))
      .toHaveText(existingName);
    await expect(dialog.getByLabel("투고처 이메일")).toHaveValue("child@example.test");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByText("투고처.csv · 2행", { exact: true })).toBeVisible();
    await expect(dialog.getByText("투고처.csv · 3행", { exact: true })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("imports explicitly mapped submission CSV rows with current sealed packages across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-submission-csv-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `투고CSV작-${suffix}`;
  const partnerName = `투고CSV문고-${suffix}`;
  const submissionTitle = `CSV투고-${suffix}`;
  const csvPath = path.join(directory, "투고 이력.csv");
  await writeFile(csvPath, [
    "작품,투고처,제목,투고일,상태,메모,원시열",
    `${workTitle},${partnerName},${submissionTitle},2026-08-10,접수,접수 번호 보관,보존값`,
    `없는 작품,${partnerName},제외행,2026-08-11,대기,,제외값`,
  ].join("\r\n"), "utf8");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
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
    await electronApp.evaluate(
      ({ dialog }, selectedPath) => {
        Object.defineProperty(dialog, "showOpenDialog", {
          configurable: true,
          value: async () => ({ canceled: false, filePaths: [selectedPath] }),
        });
      },
      csvPath,
    );
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await page.getByRole("textbox", { name: "원고" }).pressSequentially("현재 제출 원고");
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });

    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();

    await dialog.getByRole("button", { name: "CSV 가져오기", exact: true }).click();
    await dialog.getByRole("button", { name: "투고 이력 CSV 선택", exact: true }).click();
    await dialog.getByLabel("작품 이름 CSV 열").selectOption({ label: "작품" });
    await dialog.getByLabel("투고처 이름 CSV 열").last().selectOption({ label: "투고처" });
    await dialog.getByLabel("투고 제목 CSV 열").selectOption({ label: "제목" });
    await dialog.getByLabel("투고일 CSV 열").selectOption({ label: "투고일" });
    await dialog.getByLabel("상태 CSV 열").selectOption({ label: "상태" });
    await dialog.getByLabel("메모 CSV 열", { exact: true }).last()
      .selectOption({ label: "메모" });
    await dialog.getByRole("button", { name: "투고 이력 미리보기", exact: true }).click();
    const preview = dialog.getByRole("region", { name: "투고 이력 CSV 미리보기" });
    await expect(preview).toContainText("1개 반영 가능");
    await expect(preview).toContainText("1개 확인 필요");
    await preview.getByText("확인 필요한 행", { exact: true }).click();
    await expect(preview).toContainText("3행: 일치하는 작품 없음");
    await preview.getByRole("button", { name: "1개 승인 반영", exact: true }).click();
    await expect(preview.getByRole("button", { name: "반영 완료", exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 기록 제목")).toHaveValue(submissionTitle);
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("접수");
    await expect(dialog.getByLabel("투고일")).toHaveValue("2026-08-10");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("접수 번호 보관");
    const sealedPackage = dialog.getByRole("region", { name: "제출 당시 원고 봉인본" });
    await expect(sealedPackage).toContainText("1개 문서");
    const packageText = await sealedPackage.textContent();
    expect(packageText).toBeTruthy();

    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await dialog.getByRole("button", { name: /투고 이력\.csv · 2행/u }).click();
    await expect(dialog.getByRole("region", { name: "근거 상세" })).toContainText("보존값");
    await expect(dialog.getByText("투고 이력.csv · 3행", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("접수");
    await expect(dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }))
      .toHaveText(packageText ?? "");
    await dialog.getByRole("button", { name: "근거 원장", exact: true }).click();
    await expect(dialog.getByText("투고 이력.csv · 2행", { exact: true })).toBeVisible();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("reviews exact Work-owned lore Candidates without changing canonical lore before approval across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-candidates-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `검토 작품-${suffix}`;
  const documentTitle = `검토 회차-${suffix}`;
  const exactText = `북쪽 탑에서 종이 울렸다 ${randomUUID()}`;
  const manuscriptPrefix = `앞 문장 ${randomUUID()}\n`;
  const manuscriptSuffix = `\n뒤 문장 ${randomUUID()}`;
  const manuscriptText = `${manuscriptPrefix}${exactText}${manuscriptSuffix}`;
  const approvedTitle = `승인 별빛-${suffix}`;
  const rejectedTitle = `거절 별빛-${suffix}`;
  const staleTitle = `변경 별빛-${suffix}`;
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

  const selectExactTextFromEnd = async (manuscript: Locator) => {
    await manuscript.press("Control+End");
    for (let index = 0; index < manuscriptSuffix.length; index += 1) {
      await manuscript.press("ArrowLeft");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowLeft");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);
  };

  const createCandidate = async (
    page: Page,
    title: string,
  ) => {
    const dialog = await openLoreCandidateInbox(page);
    await dialog.getByLabel("후보 별빛 이름").fill(title);
    await dialog.getByLabel("후보 별빛 분류").fill("장소");
    await dialog.getByLabel("후보 별빛 내용").fill(`${title}의 확정 제안`);
    await dialog.getByLabel("별빛 후보 이유").fill("현재 선택에서 직접 기록");
    await dialog
      .getByRole("button", { name: "현재 선택을 후보로 담기", exact: true })
      .click();
    const card = dialog.locator(".lore-candidate-list li").filter({ hasText: title });
    await expect(card).toContainText(exactText);
    return { dialog, card };
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
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactTextFromEnd(manuscript);

    let { dialog, card } = await createCandidate(page, approvedTitle);
    await openStructureTab(page, "개요");
    let structureDialog = page.getByRole("region", { name: "작품 구조" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("0");
    dialog = await openLoreCandidateInbox(page);
    card = dialog.locator(".lore-candidate-list li").filter({
      hasText: approvedTitle,
    });
    await card.getByRole("button", { name: "원문 열기", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);

    dialog = await openLoreCandidateInbox(page);
    card = dialog.locator(".lore-candidate-list li").filter({
      hasText: approvedTitle,
    });
    await card.getByRole("button", { name: "승인", exact: true }).click();
    await expect(card).toContainText("승인됨");
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("1");
    await openWorkSection(page, "쓰기");
    await selectExactTextFromEnd(manuscript);
    ({ dialog, card } = await createCandidate(page, rejectedTitle));
    await card.getByRole("button", { name: "거절", exact: true }).click();
    await expect(card).toContainText("거절됨");
    await openWorkSection(page, "쓰기");
    await selectExactTextFromEnd(manuscript);
    ({ dialog } = await createCandidate(page, staleTitle));
    await openWorkSection(page, "쓰기");
    await manuscript.press("Control+End");
    await manuscript.pressSequentially(`\n변경 ${randomUUID()}`);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    dialog = await openLoreCandidateInbox(page);
    const staleCard = dialog.locator(".lore-candidate-list li").filter({
      hasText: staleTitle,
    });
    await expect(staleCard).toContainText("원문이 변경됨");
    await expect(
      staleCard.getByRole("button", { name: "승인", exact: true }),
    ).toBeDisabled();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    dialog = await openLoreCandidateInbox(page);
    await expect(
      dialog.locator(".lore-candidate-list li").filter({ hasText: approvedTitle }),
    ).toContainText("승인됨");
    await expect(
      dialog.locator(".lore-candidate-list li").filter({ hasText: rejectedTitle }),
    ).toContainText("거절됨");
    await expect(
      dialog.locator(".lore-candidate-list li").filter({ hasText: staleTitle }),
    ).toContainText("원문이 변경됨");
    await openStructureTab(page, "개요");
    structureDialog = page.getByRole("region", { name: "작품 구조" });
    await expect(
      structureDialog.getByTestId("structure-total-lore-entries").locator("strong"),
    ).toHaveText("1");
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("shows only confirmed lore cues with exact pinned inspection across restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-lore-cues-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `별빛 신호 작품-${suffix}`;
  const documentTitle = `별빛 신호 회차-${suffix}`;
  const loreTitle = `북쪽 탑-${suffix}`;
  const loreAlias = `북탑-${suffix}`;
  const candidateTitle = `후보 탑-${suffix}`;
  const loreContent = `밤마다 종이 세 번 울린다 ${suffix}`;
  const manuscriptText = `${loreTitle}에는 종이 울렸다.\n${loreAlias}은 고요했다.\n${candidateTitle}은 아직 검토 중이다.`;
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

  const selectExactText = async (
    manuscript: Locator,
    exactText: string,
  ) => {
    const from = manuscriptText.indexOf(exactText);
    expect(from).toBeGreaterThanOrEqual(0);
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < from; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactText);
  };

  const cueButtons = (page: Page) =>
    page.locator(".cm-lore-cue-gutter").getByRole("button", {
      name: /별빛 \d+개 보기/u,
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
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await selectExactText(manuscript, loreTitle);

    await openStructureTab(page, "별빛");
    const loreDialog = page.getByRole("region", { name: "별빛 관리" });
    await loreDialog.getByLabel("별빛 이름").fill(loreTitle);
    await loreDialog.getByLabel("별빛 사용자 분류").fill("장소");
    await loreDialog.getByLabel("별빛 별칭").fill(loreAlias);
    await loreDialog.getByLabel("별빛 확정 내용").fill(loreContent);
    await loreDialog
      .getByRole("button", { name: "별빛 만들기", exact: true })
      .click();
    await expect(loreDialog.locator(".lore-history-panel")).toContainText("생성");
    await openWorkSection(page, "쓰기");
    await expect(cueButtons(page)).toHaveCount(2);
    await selectExactText(manuscript, candidateTitle);
    const candidateDialog = await openLoreCandidateInbox(page);
    await candidateDialog.getByLabel("후보 별빛 이름").fill(candidateTitle);
    await candidateDialog.getByLabel("후보 별빛 분류").fill("장소");
    await candidateDialog.getByLabel("후보 별빛 내용").fill("승인 전 후보 내용");
    await candidateDialog
      .getByRole("button", { name: "현재 선택을 후보로 담기", exact: true })
      .click();
    await openWorkSection(page, "쓰기");
    await expect(cueButtons(page)).toHaveCount(2);
    await selectExactText(manuscript, candidateTitle);
    const firstCue = cueButtons(page).first();
    await firstCue.hover();
    const tooltip = page.getByRole("tooltip", { name: "별빛 미리보기" });
    await expect(tooltip).toContainText(loreTitle);
    await expect(tooltip).not.toContainText(candidateTitle);
    await firstCue.click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(candidateTitle);

    let inspector = page.getByRole("region", { name: "별빛 검사기" });
    await expect(inspector).toContainText(loreTitle);
    await expect(inspector).toContainText(loreAlias);
    await expect(inspector).toContainText(loreContent);
    await expect(inspector).not.toContainText(candidateTitle);
    await inspector.getByRole("button", { name: /원고에서 보기/u }).first().click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(loreTitle);

    await page.keyboard.insertText("임시 변경");
    await expect(cueButtons(page)).toHaveCount(1);
    await manuscript.press("Control+z");
    await expectEditorText(manuscript, manuscriptText);
    await expect(cueButtons(page)).toHaveCount(2);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await openStudioWorkspace(electronApp);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expectEditorText(manuscript, manuscriptText);
    await expect(cueButtons(page)).toHaveCount(2);
    await cueButtons(page).first().hover();
    await expect(page.getByRole("tooltip", { name: "별빛 미리보기" }))
      .toContainText(loreTitle);
    await cueButtons(page).first().click();
    inspector = page.getByRole("region", { name: "별빛 검사기" });
    await expect(inspector).toContainText(loreTitle);
    await expect(inspector).not.toContainText(candidateTitle);
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("links and approves a metadata-only publishing mail candidate across restart", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-mail-candidate-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `메일작-${suffix}`;
  const partnerName = `메일투고처-${suffix}`;
  const submissionTitle = `메일투고-${suffix}`;
  const subject = `회신-${suffix}`;
  const messageId = randomUUID();
  const sourceAccountId = randomUUID();
  const candidateId = randomUUID();
  const sourceId = randomUUID();
  const receivedAt = "2026-08-18T02:30:00.000Z";
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
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
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고 기록", exact: true }).click();
    await dialog.getByLabel("투고 작품").selectOption({ label: workTitle });
    await dialog.getByLabel("투고처").selectOption({ label: partnerName });
    await dialog.getByLabel("투고 기록 제목").fill(submissionTitle);
    await dialog.getByLabel("투고 상태").fill("접수");
    await dialog.getByLabel("투고일").fill("2026-08-10");
    await dialog
      .getByRole("button", { name: "현재 원고 버전으로 기록 추가", exact: true })
      .click();
    const packageRegion = dialog.getByRole("region", { name: "제출 당시 원고 봉인본" });
    const sealedManifest = await packageRegion.locator("small").textContent();
    expect(sealedManifest).toBeTruthy();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();
    await electronApp.close();

    const database = new DatabaseSync(
      path.join(directory, "workspace", "workspace.sqlite3"),
    );
    try {
      database.exec("PRAGMA foreign_keys = ON");
      const createdAt = "2026-08-18T02:31:00.000Z";
      database.exec("BEGIN IMMEDIATE");
      database.prepare(`
        INSERT INTO publishing_sources (
          id, schema_version, revision, created_at, updated_at, retired_at,
          source_kind, label, url, observed_at, authority, imported_fields_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceId,
        1,
        1,
        createdAt,
        createdAt,
        null,
        "message/metadata",
        messageId,
        null,
        receivedAt,
        sourceAccountId,
        JSON.stringify({
          sourceAccountId,
          messageId,
          threadId: `thread-${suffix}`,
          from: "editor@publisher.example",
          subject,
          receivedAt,
          snippet: "수정 방향을 확인해 주세요.",
          bodyFingerprint: `fingerprint-${suffix}`,
        }),
      );
      database.prepare(`
        INSERT INTO publishing_mail_candidates (
          id, schema_version, revision, created_at, updated_at, retired_at,
          source_id, source_account_id, message_id, thread_id, sender, subject,
          received_at, snippet, body_fingerprint, submission_id, match_reason,
          proposed_status, proposed_result, proposed_responded_on, proposed_note,
          classification_connection_id, classification_model, review_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        candidateId,
        1,
        1,
        createdAt,
        createdAt,
        null,
        sourceId,
        sourceAccountId,
        messageId,
        `thread-${suffix}`,
        "editor@publisher.example",
        subject,
        receivedAt,
        "수정 방향을 확인해 주세요.",
        `fingerprint-${suffix}`,
        null,
        "사용자 검토 대기",
        "회신 완료",
        "수정 요청",
        "2026-08-18",
        "첫 회신 요약",
        null,
        "",
        "needs-link",
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    } finally {
      database.close();
    }

    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    let candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard).toContainText("수정 방향을 확인해 주세요.");
    await expect(candidateCard).toContainText("투고 연결 필요");
    await candidateCard.getByLabel("메일 후보 투고 연결").selectOption({
      label: `${workTitle} · ${partnerName} · ${submissionTitle}`,
    });
    await candidateCard.getByRole("button", { name: "투고 연결", exact: true }).click();
    candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard).toContainText("승인 대기");
    await candidateCard.getByLabel("메일 제안 상태").fill("회신 확인");
    await candidateCard.getByLabel("메일 제안 결과").fill("수정 후 재검토");
    await candidateCard.getByLabel("메일 제안 회신일").fill("2026-08-19");
    await candidateCard.getByLabel("메일 제안 메모").fill("사용자가 확인한 회신 요약");
    await candidateCard.getByRole("button", { name: "제안 저장", exact: true }).click();
    candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard.getByLabel("메일 제안 메모"))
      .toHaveValue("사용자가 확인한 회신 요약");
    await candidateCard.getByRole("button", { name: "승인 반영", exact: true }).click();
    candidateCard = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidateCard).toContainText("반영 완료");

    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 확인");
    await expect(dialog.getByLabel("회신일")).toHaveValue("2026-08-19");
    await expect(dialog.getByLabel("투고 결과")).toHaveValue("수정 후 재검토");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("사용자가 확인한 회신 요약");
    await expect(dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"))
      .toHaveText(sealedManifest ?? "");
    await expect(dialog.getByLabel(`${messageId} 근거 연결`)).toBeChecked();
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    await expect(dialog.getByRole("article", { name: `${subject} 메일 후보` }))
      .toContainText("반영 완료");
    await dialog.getByRole("button", { name: "투고 이력", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(submissionTitle) }).click();
    await expect(dialog.getByLabel("투고 상태")).toHaveValue("회신 확인");
    await expect(dialog.getByLabel("투고 메모")).toHaveValue("사용자가 확인한 회신 요약");
    await expect(dialog.getByRole("region", { name: "제출 당시 원고 봉인본" }).locator("small"))
      .toHaveText(sealedManifest ?? "");
    await expect(dialog.getByLabel(`${messageId} 근거 연결`)).toBeChecked();
  } finally {
    await electronApp.close();
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("connects mail, runs the persisted app-open schedule, manually syncs, and restores state", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-publishing-mail-sync-"),
  );
  const workspaceRoot = path.join(directory, "workspace");
  const connectionRoot = path.join(directory, "mail-connection");
  const profilePath = path.join(directory, "mail-connectors.json");
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `메일동기화-${suffix}`;
  const partnerName = `회신처-${suffix}`;
  const partnerEmail = `editor-${suffix}@example.test`;
  const accountEmail = `writer-${suffix}@example.test`;
  const clientId = `desktop-client-${suffix}`;
  const accessToken = `access-${randomUUID()}`;
  const refreshToken = `refresh-${randomUUID()}`;
  const subject = `수동 회신-${suffix}`;
  const snippet = `확인할 회신 ${suffix}`;
  const body = `원장에 저장되면 안 되는 본문 ${randomUUID()}`;
  const messageId = `message-${suffix}`;
  const receivedRequests: string[] = [];
  let baseUrl = "";
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", baseUrl);
    receivedRequests.push(`${request.method ?? "GET"} ${requestUrl.pathname}${requestUrl.search}`);
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (requestUrl.pathname === "/authorize") {
        const redirectUri = requestUrl.searchParams.get("redirect_uri");
        const state = requestUrl.searchParams.get("state");
        if (redirectUri === null || state === null) {
          response.writeHead(400).end();
          return;
        }
        const callback = new URL(redirectUri);
        callback.searchParams.set("code", `code-${suffix}`);
        callback.searchParams.set("state", state);
        response.writeHead(302, { Location: callback.toString() });
        response.end();
        return;
      }
      if (requestUrl.pathname === "/token") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          scope: "mail.readonly",
        }));
        return;
      }
      if (requestUrl.pathname === "/mail/profile") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ emailAddress: accountEmail }));
        return;
      }
      if (requestUrl.pathname === "/mail/messages") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ messages: [{ id: messageId }] }));
        return;
      }
      if (requestUrl.pathname === `/mail/messages/${messageId}`) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          id: messageId,
          threadId: `thread-${suffix}`,
          internalDate: String(Date.parse("2026-08-10T10:30:00.000Z")),
          snippet,
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: partnerEmail },
              { name: "Subject", value: subject },
            ],
            body: { data: Buffer.from(body, "utf8").toString("base64url") },
          },
        }));
        return;
      }
      if (requestUrl.pathname === "/revoke") {
        response.writeHead(200).end();
        return;
      }
      response.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected a local mail connector TCP address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  await writeFile(profilePath, JSON.stringify({
    schemaVersion: 1,
    connectors: [{
      connectorKind: "google-mail-oauth-v1",
      displayName: "테스트 메일 (읽기 전용)",
      authorizationEndpoint: `${baseUrl}/authorize`,
      tokenEndpoint: `${baseUrl}/token`,
      revocationEndpoint: `${baseUrl}/revoke`,
      apiBaseUrl: `${baseUrl}/mail`,
      scope: "mail.readonly",
    }],
  }), "utf8");
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_PUBLISHING_MAIL_CONNECTION_ROOT_PATH: connectionRoot,
    EUM_STUDIO_PUBLISHING_MAIL_CONNECTOR_PROFILE_PATH: profilePath,
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
  const routeAuthorizationInsideElectron = async () => {
    await electronApp.evaluate(({ shell: electronShell }) => {
      const mutableShell = electronShell as typeof electronShell & {
        openExternal: (url: string) => Promise<void>;
      };
      mutableShell.openExternal = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Authorization route failed: ${response.status}`);
      };
    });
  };

  try {
    await routeAuthorizationInsideElectron();
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill("1화");
    await createWorkDialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await openStudioHome(page);
    await openPublishingFromLibrary(page);
    let dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "투고처 원장", exact: true }).click();
    await dialog.getByRole("button", { name: "새 투고처", exact: true }).click();
    await dialog.getByLabel("투고처 이름").fill(partnerName);
    await dialog.getByLabel("이메일").fill(partnerEmail);
    await dialog.getByRole("button", { name: "투고처 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    await expect(dialog.getByLabel("메일 서비스")).toHaveValue("google-mail-oauth-v1");
    await dialog.getByLabel("메일 OAuth client ID").fill(clientId);
    await dialog.getByRole("button", { name: "메일 계정 연결", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "메일 계정 연결" }))
      .toContainText(accountEmail);
    const scheduleRegion = dialog.getByRole("region", { name: "메일 자동 확인 일정" });
    await scheduleRegion.getByLabel("자동 확인 시각").fill("00:00");
    await scheduleRegion.getByLabel("앱 실행 중 자동 확인").click();
    await expect(scheduleRegion.getByLabel("앱 실행 중 자동 확인")).toBeChecked();
    await expect(scheduleRegion).toContainText("마지막 확인 결과");
    await expect(scheduleRegion).toContainText("성공");
    const candidate = dialog.getByRole("article", { name: `${subject} 메일 후보` });
    await expect(candidate).toContainText(snippet);
    await expect(candidate).toContainText("투고 연결 필요");
    await dialog.getByRole("button", { name: "지금 동기화", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("1건 확인 · 새 후보 0건");
    expect(receivedRequests.some((request) =>
      request.includes("/mail/messages?") &&
      decodeURIComponent(request).includes(`from:${partnerEmail}`)
    )).toBe(true);
    const storedConnection = await readFile(path.join(connectionRoot, "connection.json"), "utf8");
    expect(storedConnection).not.toContain(accessToken);
    expect(storedConnection).not.toContain(refreshToken);
    expect(storedConnection).toContain(accountEmail);
    const storedSchedule = await readFile(path.join(connectionRoot, "schedule.json"), "utf8");
    expect(storedSchedule).toContain('"enabled":true');
    expect(storedSchedule).toContain('"localTime":"00:00"');
    expect(storedSchedule).toContain('"lastAttemptStatus":"succeeded"');
    const databaseBytes = await readFile(path.join(workspaceRoot, "workspace.sqlite3"));
    expect(databaseBytes.includes(Buffer.from(body, "utf8"))).toBe(false);
    await dialog.getByRole("button", { name: "투고 운영 닫기" }).click();

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await openPublishingFromLibrary(page);
    dialog = page.getByRole("dialog", { name: "투고 운영" });
    await dialog.getByRole("button", { name: "메일 후보", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "메일 계정 연결" }))
      .toContainText(accountEmail);
    const restoredScheduleRegion = dialog.getByRole("region", { name: "메일 자동 확인 일정" });
    await expect(restoredScheduleRegion.getByLabel("앱 실행 중 자동 확인")).toBeChecked();
    await expect(restoredScheduleRegion.getByLabel("자동 확인 시각")).toHaveValue("00:00");
    await expect(restoredScheduleRegion).toContainText("성공");
    await expect(dialog.getByRole("article", { name: `${subject} 메일 후보` }))
      .toContainText(snippet);
    await dialog.getByRole("button", { name: "연결 해제", exact: true }).click();
    await expect(dialog.getByLabel("메일 OAuth client ID")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "메일 계정 연결", exact: true }))
      .toBeDisabled();
    expect(await readFile(path.join(connectionRoot, "schedule.json"), "utf8"))
      .toContain('"enabled":true');
  } finally {
    await electronApp.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps an anchorless event while its exact source is linked, replaced, retired, and restarted", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-event-source-e2e-"),
  );
  const workTitle = `사건 근거 작품-${randomUUID().slice(0, 8)}`;
  const documentTitle = `사건 근거 회차-${randomUUID().slice(0, 8)}`;
  const eventTitle = `예정 사건-${randomUUID().slice(0, 8)}`;
  const prefix = "도입부 ";
  const firstQuote = `첫 근거 ${randomUUID().slice(0, 8)}`;
  const middle = " 사이 문장 ";
  const secondQuote = `교체 근거 ${randomUUID().slice(0, 8)}`;
  const manuscriptText = `${prefix}${firstQuote}${middle}${secondQuote} 마무리`;
  const firstFrom = prefix.length;
  const secondFrom = prefix.length + firstQuote.length + middle.length;
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

  const selectExactRange = async (
    manuscript: Locator,
    from: number,
    text: string,
  ) => {
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < from; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < text.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(text);
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByLabel("사건 메모").fill("원고 연결 전 사건");
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();

    await openStructureTab(page, "사건");
    let eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    let eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await expect(eventRow).toContainText("원고 미연결");
    await openWorkSection(page, "쓰기");
    await selectExactRange(manuscript, firstFrom, firstQuote);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "현재 선택 연결", exact: true })
      .click();
    await expect(eventRow).toContainText(`${firstFrom}–${firstFrom + firstQuote.length}`);

    const linkedProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(linkedProjection.eventBlocks).toHaveLength(1);
    expect(linkedProjection.eventSources).toHaveLength(1);
    expect(linkedProjection.eventSources[0]?.anchors[0]?.exactQuote).toBe(firstQuote);
    const linkedSourceId = linkedProjection.eventSources[0]!.eventSourceId;

    await openWorkSection(page, "쓰기");
    await selectExactRange(manuscript, secondFrom, secondQuote);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "현재 선택으로 교체", exact: true })
      .click();
    await expect(eventRow).toContainText(
      `${secondFrom}–${secondFrom + secondQuote.length}`,
    );
    const replacedProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(replacedProjection.eventSources).toHaveLength(1);
    expect(replacedProjection.eventSources[0]?.eventSourceId).not.toBe(linkedSourceId);
    expect(replacedProjection.eventSources[0]?.anchors[0]?.exactQuote).toBe(secondQuote);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow.getByRole("button", { name: new RegExp(eventTitle) }).click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(secondQuote);

    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "원고 근거 해제", exact: true })
      .click();
    await expect(eventRow).toContainText("원고 미연결");
    const retiredProjection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(retiredProjection.eventBlocks).toHaveLength(1);
    expect(retiredProjection.eventSources).toEqual([]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "사건");
    eventRow = page
      .getByRole("region", { name: "현재 회차 사건" })
      .locator("li")
      .filter({ hasText: eventTitle });
    await expect(eventRow).toContainText("원고 미연결");
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps exact-selection event creation after the EventSource split", async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-exact-event-source-e2e-"),
  );
  const workTitle = `선택 사건 작품-${randomUUID().slice(0, 8)}`;
  const documentTitle = `선택 사건 회차-${randomUUID().slice(0, 8)}`;
  const eventTitle = `선택 사건-${randomUUID().slice(0, 8)}`;
  const prefix = "앞 문장 ";
  const exactQuote = `정확한 사건 근거 ${randomUUID().slice(0, 8)}`;
  const manuscriptText = `${prefix}${exactQuote} 뒤 문장`;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await manuscript.press("Control+Home");
    for (let index = 0; index < prefix.length; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < exactQuote.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactQuote);

    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByLabel("사건 메모").fill("선택 생성 회귀");
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();

    const projection = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) {
        throw new Error("Expected an active Work");
      }
      return window.eumStudio.structure.listEventBlocks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    const eventBlock = projection.eventBlocks.find(
      (candidate) => candidate.title === eventTitle,
    );
    expect(eventBlock).toBeDefined();
    expect(eventBlock).not.toHaveProperty("rangeGroupId");
    const source = projection.eventSources.find(
      (candidate) => candidate.eventBlockId === eventBlock?.eventBlockId,
    );
    expect(source?.role).toBe("primary");
    expect(source?.anchors[0]?.exactQuote).toBe(exactQuote);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    await page
      .getByRole("region", { name: "현재 회차 사건" })
      .getByRole("button", { name: new RegExp(eventTitle) })
      .click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(exactQuote);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps bidirectional plot/event links, independent titles, unlinking, and restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-event-link-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `플롯 사건 작품-${suffix}`;
  const documentTitle = `플롯 사건 회차-${suffix}`;
  const eventTitle = `첫 사건-${suffix}`;
  const changedPlotTitle = `독립 플롯-${suffix}`;
  const supportingEventTitle = `보조 사건-${suffix}`;
  const plannedPlotTitle = `예정 플롯-${suffix}`;
  const exactPlotTitle = `선택 플롯-${suffix}`;
  const prefix = "도입 ";
  const firstQuote = `첫 사건 근거 ${suffix}`;
  const middle = " 사이 ";
  const secondQuote = `플롯 생성 근거 ${suffix}`;
  const manuscriptText = `${prefix}${firstQuote}${middle}${secondQuote} 마무리`;
  const firstFrom = prefix.length;
  const secondFrom = prefix.length + firstQuote.length + middle.length;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const selectRange = async (from: number, text: string) => {
      await manuscript.click();
      await manuscript.press("Control+Home");
      for (let index = 0; index < from; index += 1) {
        await manuscript.press("ArrowRight");
      }
      for (let index = 0; index < text.length; index += 1) {
        await manuscript.press("Shift+ArrowRight");
      }
      await expect.poll(() =>
        manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
      ).toBe(text);
    };

    await selectRange(firstFrom, firstQuote);
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    let eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByLabel("사건 메모").fill("플롯으로 복사할 사건 메모");
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();

    await openStructureTab(page, "사건");
    let eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    let eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "플롯으로 만들기", exact: true })
      .click();
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(eventTitle);
    let linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await expect(linkRegion).toContainText(eventTitle);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await expect(
      eventRow.getByRole("button", { name: "연결 플롯 열기", exact: true }),
    ).toBeVisible();
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    const afterReuse = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      const [plots, links] = await Promise.all([
        window.eumStudio.plots.list({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
        window.eumStudio.plots.listEventLinks({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
      ]);
      return { plots: plots.plots, links: links.links };
    });
    expect(afterReuse.plots).toHaveLength(1);
    expect(afterReuse.links).toHaveLength(1);

    await plotDialog.getByLabel("플롯 제목").fill(changedPlotTitle);
    await plotDialog
      .getByRole("button", { name: "변경 저장", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await expect(linkRegion.getByText("제목이 서로 다름", { exact: true }))
      .toBeVisible();
    await expect(linkRegion).toContainText(eventTitle);
    await openWorkSection(page, "쓰기");
    await openReviewRail(page);
    await page.getByRole("tab", { name: "현재", exact: true }).click();
    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    eventDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await eventDialog.getByLabel("사건 제목").fill(supportingEventTitle);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(eventDialog).toBeHidden();
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("연결할 사건").selectOption({
      label: supportingEventTitle,
    });
    await plotDialog.getByLabel("사건 연결 역할").selectOption("supporting");
    await plotDialog
      .getByRole("button", { name: "사건 연결", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    let supportingLinkRow = linkRegion.locator("li").filter({
      hasText: supportingEventTitle,
    });
    await expect(supportingLinkRow).toContainText("보조 사건");
    await supportingLinkRow
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(supportingLinkRow).toHaveCount(0);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    await expect(
      eventRegion.locator("li").filter({ hasText: supportingEventTitle }),
    ).toBeVisible();

    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByLabel("연결할 사건").selectOption({
      label: supportingEventTitle,
    });
    await plotDialog.getByLabel("사건 연결 역할").selectOption("supporting");
    await plotDialog
      .getByRole("button", { name: "사건 연결", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    supportingLinkRow = linkRegion.locator("li").filter({
      hasText: supportingEventTitle,
    });
    await expect(supportingLinkRow).toBeVisible();

    await plotDialog.getByRole("button", { name: "새 플롯", exact: true }).click();
    await plotDialog.getByLabel("플롯 제목").fill(plannedPlotTitle);
    await plotDialog.getByLabel("플롯 요약").fill("예정 사건 메모");
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "예정 사건 만들기", exact: true })
      .click();
    linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await expect(linkRegion).toContainText(plannedPlotTitle);
    await openWorkSection(page, "쓰기");
    await selectRange(secondFrom, secondQuote);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await plotDialog.getByRole("button", { name: "새 플롯", exact: true }).click();
    await plotDialog.getByLabel("플롯 제목").fill(exactPlotTitle);
    await plotDialog
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotDialog
      .getByRole("button", { name: "현재 선택으로 사건 만들기", exact: true })
      .click();
    const beforeRestart = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      const [events, links] = await Promise.all([
        window.eumStudio.structure.listEventBlocks({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
        window.eumStudio.plots.listEventLinks({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
        }),
      ]);
      return { events, links: links.links };
    });
    expect(beforeRestart.links).toHaveLength(4);
    expect(beforeRestart.events.eventBlocks.find(
      (event) => event.title === eventTitle,
    )?.title).toBe(eventTitle);
    const exactEvent = beforeRestart.events.eventBlocks.find(
      (event) => event.title === exactPlotTitle,
    );
    expect(beforeRestart.events.eventSources.find(
      (source) => source.eventBlockId === exactEvent?.eventBlockId,
    )?.anchors[0]?.exactQuote).toBe(secondQuote);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    eventRow = eventRegion.locator("li").filter({ hasText: eventTitle });
    await eventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(changedPlotTitle);
    const restartedPrimaryLinkRow = plotDialog
      .getByRole("region", { name: "플롯 연결 사건" })
      .locator("li")
      .filter({ hasText: eventTitle });
    await expect(
      restartedPrimaryLinkRow.getByText("제목이 서로 다름", { exact: true }),
    ).toBeVisible();
    const restartedLinks = await page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
      return window.eumStudio.plots.listEventLinks({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      });
    });
    expect(restartedLinks.links).toHaveLength(4);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("keeps the movable plot board as the primary plot workspace and persists moves", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-primary-plot-board-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `주 플롯 작업면-${suffix}`;
  const documentTitle = `주 플롯 회차-${suffix}`;
  const firstPlotTitle = `첫 이동 플롯-${suffix}`;
  const secondPlotTitle = `둘째 이동 플롯-${suffix}`;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();

    await openStructureTab(page, "플롯");
    let plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    let plotSurface = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    let boardRegion = plotSurface.getByRole("region", { name: "플롯 보드" });
    await expect(boardRegion).toBeVisible();
    await expect(boardRegion).toContainText("카드를 끌어 순서를 옮기고");

    await plotSurface.getByLabel("플롯 제목").fill(firstPlotTitle);
    await plotSurface
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();
    await plotSurface
      .getByRole("button", { name: "새 플롯", exact: true })
      .click();
    await plotSurface.getByLabel("플롯 제목").fill(secondPlotTitle);
    await plotSurface
      .getByRole("button", { name: "플롯 만들기", exact: true })
      .click();

    let boardCards = boardRegion.locator(
      ".plot-board-lane > ol > li[data-plot-placement-id]",
    );
    let boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardCardTitles).toHaveText([firstPlotTitle, secondPlotTitle]);

    const primaryPanelBounds = await plotSurface
      .locator(".plot-manager-list")
      .boundingBox();
    const detailPanelBounds = await plotSurface
      .locator(".plot-manager-detail")
      .boundingBox();
    if (primaryPanelBounds === null || detailPanelBounds === null) {
      throw new Error("Expected visible plot workspace panels");
    }
    expect(primaryPanelBounds.width).toBeGreaterThan(detailPanelBounds.width);

    const dragSource = boardCards.nth(1).locator(".plot-board-card-select");
    const dragTarget = boardCards.nth(0).locator(".plot-board-card-select");
    const dragSourceBounds = await dragSource.boundingBox();
    const dragTargetBounds = await dragTarget.boundingBox();
    if (dragSourceBounds === null || dragTargetBounds === null) {
      throw new Error("Expected visible movable plot cards");
    }
    await page.mouse.move(
      dragSourceBounds.x + dragSourceBounds.width / 2,
      dragSourceBounds.y + dragSourceBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      dragTargetBounds.x + dragTargetBounds.width / 2,
      dragTargetBounds.y + dragTargetBounds.height * 0.25,
      { steps: 4 },
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "true");
    await page.mouse.up();
    await expect(boardCardTitles).toHaveText([secondPlotTitle, firstPlotTitle]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "플롯");
    plotWorkspace = page.getByRole("region", { name: "플롯 작업면" });
    plotSurface = plotWorkspace.getByRole("region", {
      name: "플롯 보드 작업면",
    });
    boardRegion = plotSurface.getByRole("region", { name: "플롯 보드" });
    boardCards = boardRegion.locator(
      ".plot-board-lane > ol > li[data-plot-placement-id]",
    );
    boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardRegion).toBeVisible();
    await expect(boardCardTitles).toHaveText([secondPlotTitle, firstPlotTitle]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("moves default plot board placements without moving exact manuscript evidence and keeps the order after restart", async () => {
  test.setTimeout(150_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-board-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = "플롯 보드 작품-" + suffix;
  const documentTitle = "플롯 보드 회차-" + suffix;
  const firstEventTitle = "첫 보드 사건-" + suffix;
  const secondEventTitle = "둘째 보드 사건-" + suffix;
  const prefix = "도입 ";
  const firstQuote = "첫 보드 근거 " + suffix;
  const middle = " 사이 ";
  const secondQuote = "둘째 보드 근거 " + suffix;
  const manuscriptText = prefix + firstQuote + middle + secondQuote + " 마무리";
  const firstFrom = prefix.length;
  const secondFrom = prefix.length + firstQuote.length + middle.length;
  const electronArguments = [
    ".",
    "--user-data-dir=" + path.join(directory, "electron-user-data"),
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const selectExactRange = async (
    manuscript: Locator,
    from: number,
    text: string,
  ) => {
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < from; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < text.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(text);
  };
  const createSelectedEvent = async (
    page: Page,
    manuscript: Locator,
    from: number,
    quote: string,
    title: string,
  ) => {
    await selectExactRange(manuscript, from, quote);
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await eventDialog.getByLabel("사건 제목").fill(title);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(eventDialog).toBeHidden();
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);
    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await createSelectedEvent(
      page,
      manuscript,
      firstFrom,
      firstQuote,
      firstEventTitle,
    );
    await createSelectedEvent(
      page,
      manuscript,
      secondFrom,
      secondQuote,
      secondEventTitle,
    );

    await openStructureTab(page, "사건");
    let eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    let firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    let secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await firstEventRow
      .getByRole("button", { name: "플롯으로 만들기", exact: true })
      .click();
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await secondEventRow
      .getByRole("button", { name: "플롯으로 만들기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    let boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    let boardCards = boardRegion.locator(".plot-board-lane > ol > li");
    await expect(boardCards).toHaveCount(2);
    await expect(boardCards.nth(0)).toContainText(firstEventTitle);
    await expect(boardCards.nth(1)).toContainText(secondEventTitle);

    await boardCards.nth(1)
      .getByRole("button", { name: "앞으로 이동", exact: true })
      .click();
    await expect(boardCards.nth(0)).toContainText(secondEventTitle);
    await expect(boardCards.nth(1)).toContainText(firstEventTitle);
    const linkRegion = plotDialog.getByRole("region", { name: "플롯 연결 사건" });
    await linkRegion
      .getByRole("button", { name: "연결 해제", exact: true })
      .click();
    await expect(linkRegion).toContainText("이 플롯에 연결된 사건이 없습니다.");
    await expect(boardCards).toHaveCount(2);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await firstEventRow
      .getByRole("button", { name: "연결 플롯 열기", exact: true })
      .click();
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    boardCards = boardRegion.locator(".plot-board-lane > ol > li");
    await expect(boardCards).toHaveCount(2);
    await expect(boardCards.nth(0)).toContainText(secondEventTitle);
    await expect(boardCards.nth(1)).toContainText(firstEventTitle);
    await openStructureTab(page, "사건");
    eventRegion = page.getByRole("region", { name: "현재 회차 사건" });
    firstEventRow = eventRegion.locator("li").filter({ hasText: firstEventTitle });
    secondEventRow = eventRegion.locator("li").filter({ hasText: secondEventTitle });
    await expect(
      secondEventRow.getByRole("button", { name: "플롯으로 만들기", exact: true }),
    ).toBeVisible();
    await firstEventRow.getByRole("button", { name: new RegExp(firstEventTitle) }).click();
    await expect.poll(() =>
      manuscript.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    ).toBe(firstQuote);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("drags plot placements with local preview, cancellation, keyboard movement, and conflict rollback", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-drag-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `플롯 드래그 작품-${suffix}`;
  const documentTitle = `플롯 드래그 회차-${suffix}`;
  const plotTitles = [
    `첫 드래그 플롯-${suffix}`,
    `둘째 드래그 플롯-${suffix}`,
    `셋째 드래그 플롯-${suffix}`,
    `넷째 드래그 플롯-${suffix}`,
    `다섯째 드래그 플롯-${suffix}`,
    `여섯째 드래그 플롯-${suffix}`,
    `일곱째 드래그 플롯-${suffix}`,
  ] as const;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const readBoard = async (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.plots.getDefaultBoard({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });
  const pointerPosition = async (
    locator: Locator,
    verticalFraction = 0.5,
  ) => {
    const bounds = await locator.boundingBox();
    if (bounds === null) throw new Error("Expected a visible plot card");
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height * verticalFraction,
    };
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });

    for (const [index, title] of plotTitles.entries()) {
      if (index > 0) {
        await plotDialog
          .getByRole("button", { name: "새 플롯", exact: true })
          .click();
      }
      await plotDialog.getByLabel("플롯 제목").fill(title);
      await plotDialog
        .getByRole("button", { name: "플롯 만들기", exact: true })
        .click();
      await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(title);
    }

    let boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    let boardCards = boardRegion.locator("[data-plot-placement-id]");
    let boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardCardTitles).toHaveText(plotTitles);
    const plotList = plotDialog.getByRole("region", { name: "플롯 목록" });
    await plotList.evaluate((element) => {
      element.scrollTop = 0;
    });

    const boardBeforeThreshold = await readBoard(page);
    let sourceSelect = boardCards.nth(2).locator(".plot-board-card-select");
    let sourcePoint = await pointerPosition(sourceSelect);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(sourcePoint.x + 5, sourcePoint.y);
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(0);
    await page.mouse.up();
    const boardAfterThreshold = await readBoard(page);
    expect(boardAfterThreshold.revision).toBe(boardBeforeThreshold.revision);
    expect(boardAfterThreshold.lanes[0]?.placements.map(
      (placement) => placement.plotBeat.title,
    )).toEqual(plotTitles);

    await plotList.evaluate((element) => {
      element.scrollTop = 0;
    });
    sourceSelect = boardCards.nth(0).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    const listBounds = await plotList.boundingBox();
    if (listBounds === null) throw new Error("Expected the plot list to be visible");
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(
      sourcePoint.x,
      listBounds.y + listBounds.height - 5,
      { steps: 4 },
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "true");
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await expect.poll(() =>
      plotList.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(0);
    await page.mouse.up();
    const boardAfterEscape = await readBoard(page);
    expect(boardAfterEscape.revision).toBe(boardBeforeThreshold.revision);

    await plotList.evaluate((element) => {
      element.scrollTop = 0;
    });
    sourceSelect = boardCards.nth(2).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    let targetSelect = boardCards.nth(0).locator(".plot-board-card-select");
    let targetPoint = await pointerPosition(targetSelect, 0.25);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await sourceSelect.dispatchEvent("pointercancel", {
      bubbles: true,
      pointerId: 1,
    });
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await page.mouse.up();
    const boardAfterPointerCancel = await readBoard(page);
    expect(boardAfterPointerCancel.revision).toBe(boardBeforeThreshold.revision);

    sourceSelect = boardCards.nth(2).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    targetSelect = boardCards.nth(0).locator(".plot-board-card-select");
    targetPoint = await pointerPosition(targetSelect, 0.25);
    const boardBeforeDrop = await readBoard(page);
    const movedBeforeDrop = boardBeforeDrop.lanes[0]?.placements.find(
      (placement) => placement.plotBeat.title === plotTitles[2],
    );
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
    await expect(boardRegion).toHaveAttribute("data-drag-active", "true");
    await expect(sourceSelect.locator("xpath=..")).toHaveClass(
      /is-drag-preview-source/u,
    );
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await page.mouse.up();
    const expectedAfterDrop = [
      plotTitles[2],
      plotTitles[0],
      plotTitles[1],
      ...plotTitles.slice(3),
    ];
    await expect(boardCardTitles).toHaveText(expectedAfterDrop);
    const boardAfterDrop = await readBoard(page);
    const movedAfterDrop = boardAfterDrop.lanes[0]?.placements.find(
      (placement) => placement.plotBeat.title === plotTitles[2],
    );
    expect(boardAfterDrop.revision).toBe(boardBeforeDrop.revision + 1);
    expect(movedAfterDrop?.revision).toBe((movedBeforeDrop?.revision ?? 0) + 1);
    for (const placement of boardBeforeDrop.lanes[0]?.placements ?? []) {
      if (placement.plotBeat.title === plotTitles[2]) continue;
      expect(boardAfterDrop.lanes[0]?.placements.find(
        (candidate) => candidate.plotPlacementId === placement.plotPlacementId,
      )?.revision).toBe(placement.revision);
    }

    const firstPlotCard = boardCards.filter({ hasText: plotTitles[0] });
    const boardBeforeKeyboard = await readBoard(page);
    await firstPlotCard.locator(".plot-board-card-select").press("Alt+ArrowDown");
    const expectedAfterKeyboard = [
      plotTitles[2],
      plotTitles[1],
      plotTitles[0],
      ...plotTitles.slice(3),
    ];
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);
    const boardAfterKeyboard = await readBoard(page);
    expect(boardAfterKeyboard.revision).toBe(boardBeforeKeyboard.revision + 1);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "플롯");
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    boardCards = boardRegion.locator("[data-plot-placement-id]");
    boardCardTitles = boardCards.locator(".plot-board-card-select strong");
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);

    const staleBoard = await readBoard(page);
    const staleLane = staleBoard.lanes[0];
    if (staleLane === undefined) throw new Error("Expected a default plot lane");
    const externallyMoved = staleLane.placements.find(
      (placement) => placement.plotBeat.title === plotTitles[0],
    );
    const staleFirst = staleLane.placements[0];
    if (externallyMoved === undefined || staleFirst === undefined) {
      throw new Error("Expected plot placements for the conflict fixture");
    }
    const authoritativeAfterExternalMove = await page.evaluate(
      async ({
        workId,
        boardId,
        laneId,
        placementId,
        afterPlacementId,
        placementRevision,
        boardRevision,
      }) => window.eumStudio.plots.movePlacement({
        schemaVersion: 1,
        workId,
        plotPlacementId: placementId,
        targetBoardId: boardId,
        targetLaneId: laneId,
        afterPlacementId,
        expectedPlacementRevision: placementRevision,
        expectedBoardRevision: boardRevision,
      }),
      {
        workId: staleBoard.workId,
        boardId: staleBoard.plotBoardId,
        laneId: staleLane.plotLaneId,
        placementId: externallyMoved.plotPlacementId,
        afterPlacementId: staleFirst.plotPlacementId,
        placementRevision: externallyMoved.revision,
        boardRevision: staleBoard.revision,
      },
    );
    expect(authoritativeAfterExternalMove.lanes[0]?.placements.map(
      (placement) => placement.plotBeat.title,
    )).toEqual([
      plotTitles[0],
      plotTitles[2],
      plotTitles[1],
      ...plotTitles.slice(3),
    ]);
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);

    sourceSelect = boardCards.nth(0).locator(".plot-board-card-select");
    sourcePoint = await pointerPosition(sourceSelect);
    targetSelect = boardCards.nth(1).locator(".plot-board-card-select");
    targetPoint = await pointerPosition(targetSelect, 0.75);
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(1);
    await page.mouse.up();
    await expect(plotDialog.getByRole("alert")).toHaveText(
      "플롯 배치 순서가 달라졌습니다. 다시 열어 확인하세요.",
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await expect(boardRegion.locator("[data-plot-insertion-line]")).toHaveCount(0);
    await expect(boardCardTitles).toHaveText(expectedAfterKeyboard);
    const boardAfterConflict = await readBoard(page);
    expect(boardAfterConflict.revision).toBe(authoritativeAfterExternalMove.revision);
    expect(boardAfterConflict.lanes[0]?.placements.map(
      (placement) => placement.plotBeat.title,
    )).toEqual(
      authoritativeAfterExternalMove.lanes[0]?.placements.map(
        (placement) => placement.plotBeat.title,
      ),
    );
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("places overlapping plots on an unsnapped normalized story-time map and preserves them across restart", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-plot-story-time-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `시간 지도 작품-${suffix}`;
  const documentTitle = `시간 지도 회차-${suffix}`;
  const plotTitles = [
    `첫 시간 플롯-${suffix}`,
    `둘째 시간 플롯-${suffix}`,
    `셋째 시간 플롯-${suffix}`,
  ] as const;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const readBoard = async (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.plots.getDefaultBoard({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });
  const dragToFraction = async (
    page: Page,
    source: Locator,
    track: Locator,
    fraction: number,
  ) => {
    const sourceBounds = await source.boundingBox();
    const trackBounds = await track.boundingBox();
    if (sourceBounds === null || trackBounds === null) {
      throw new Error("Expected visible story-time drag surfaces");
    }
    const sourcePoint = {
      x: sourceBounds.x + sourceBounds.width / 2,
      y: sourceBounds.y + sourceBounds.height / 2,
    };
    const targetPoint = {
      x: trackBounds.x + trackBounds.width * fraction,
      y: trackBounds.y + Math.min(trackBounds.height / 2, 48),
    };
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 4 });
  };

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openStructureTab(page, "플롯");
    let plotDialog = page.getByRole("region", { name: "플롯 작업면" });

    for (const [index, title] of plotTitles.entries()) {
      if (index > 0) {
        await plotDialog
          .getByRole("button", { name: "새 플롯", exact: true })
          .click();
      }
      await plotDialog.getByLabel("플롯 제목").fill(title);
      await plotDialog
        .getByRole("button", { name: "플롯 만들기", exact: true })
        .click();
      await expect(plotDialog.getByLabel("플롯 제목")).toHaveValue(title);
    }

    let boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    const boardBefore = await readBoard(page);
    const orderBefore = boardBefore.lanes[0]!.placements.map((placement) => ({
      id: placement.plotPlacementId,
      orderKey: placement.orderKey,
      revision: placement.revision,
    }));
    await boardRegion
      .getByRole("button", { name: "시간 지도", exact: true })
      .click();
    await expect(boardRegion).toHaveAttribute("data-board-view", "time-map");
    let track = boardRegion.locator('[data-story-time-track="true"]');
    await expect(track).toBeVisible();
    await expect
      .poll(async () =>
        Number(await track.getAttribute("data-story-time-point-footprint")),
      )
      .toBeGreaterThan(0);
    await expect(
      boardRegion.locator('[data-story-time-unassigned="true"]'),
    ).toHaveCount(3);

    const firstUnassigned = boardRegion
      .locator('[data-story-time-unassigned="true"]')
      .filter({ hasText: plotTitles[0] });
    await dragToFraction(page, firstUnassigned, track, 0.37416666666666665);
    const firstPreview = boardRegion.locator(
      '[data-story-time-preview="true"]',
    );
    await expect(firstPreview).toHaveCount(1);
    const firstPreviewValue = Number(
      await firstPreview.getAttribute("data-story-time"),
    );
    expect(firstPreviewValue).toBeGreaterThan(37);
    expect(firstPreviewValue).toBeLessThan(38);
    expect(Number.isInteger(firstPreviewValue)).toBe(false);
    const boardDuringFirstDrag = await readBoard(page);
    expect(boardDuringFirstDrag.revision).toBe(boardBefore.revision);
    expect(boardDuringFirstDrag.lanes[0]!.placements[0]!.storyTime).toBeNull();
    await page.mouse.up();
    await expect.poll(async () =>
      (await readBoard(page)).lanes[0]!.placements[0]!.storyTime,
    ).toBe(firstPreviewValue);

    const firstBoardAfterDrop = await readBoard(page);
    expect(firstBoardAfterDrop.revision).toBe(boardBefore.revision + 1);
    expect(firstBoardAfterDrop.lanes[0]!.placements[0]!.revision).toBe(
      orderBefore[0]!.revision + 1,
    );
    expect(firstBoardAfterDrop.lanes[0]!.placements[1]!.revision).toBe(
      orderBefore[1]!.revision,
    );

    const secondUnassigned = boardRegion
      .locator('[data-story-time-unassigned="true"]')
      .filter({ hasText: plotTitles[1] });
    await expect(secondUnassigned).toBeEnabled();
    await dragToFraction(page, secondUnassigned, track, 0.37416666666666665);
    const secondPreview = boardRegion.locator(
      '[data-story-time-preview="true"]',
    );
    await expect(secondPreview).toHaveCount(1);
    const secondPreviewValue = Number(
      await secondPreview.getAttribute("data-story-time"),
    );
    expect(Number.isInteger(secondPreviewValue)).toBe(false);
    await page.mouse.up();
    await expect.poll(async () =>
      (await readBoard(page)).lanes[0]!.placements[1]!.storyTime,
    ).toBe(secondPreviewValue);
    await expect(
      boardRegion.locator('[data-story-time-stack-level="0"]'),
    ).toHaveCount(1);
    await expect(
      boardRegion.locator('[data-story-time-stack-level="1"]'),
    ).toHaveCount(1);

    const thirdUnassigned = boardRegion
      .locator('[data-story-time-unassigned="true"]')
      .filter({ hasText: plotTitles[2] });
    await expect(thirdUnassigned).toBeEnabled();
    await dragToFraction(page, thirdUnassigned, track, 0.73125);
    const thirdPreview = boardRegion.locator(
      '[data-story-time-preview="true"]',
    );
    await expect(thirdPreview).toHaveCount(1);
    const thirdPreviewValue = Number(
      await thirdPreview.getAttribute("data-story-time"),
    );
    expect(Number.isInteger(thirdPreviewValue)).toBe(false);
    await page.mouse.up();
    await expect.poll(async () =>
      (await readBoard(page)).lanes[0]!.placements[2]!.storyTime,
    ).toBe(thirdPreviewValue);

    const boardAfterDrops = await readBoard(page);
    expect(boardAfterDrops.revision).toBe(boardBefore.revision + 3);
    expect(boardAfterDrops.lanes[0]!.placements.map((placement) => ({
      id: placement.plotPlacementId,
      orderKey: placement.orderKey,
    }))).toEqual(orderBefore.map(({ id, orderKey }) => ({ id, orderKey })));
    expect(boardAfterDrops.lanes[0]!.placements.map(
      (placement) => placement.storyTime,
    )).toEqual([firstPreviewValue, secondPreviewValue, thirdPreviewValue]);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openStructureTab(page, "플롯");
    plotDialog = page.getByRole("region", { name: "플롯 작업면" });
    boardRegion = plotDialog.getByRole("region", { name: "플롯 보드" });
    await boardRegion
      .getByRole("button", { name: "시간 지도", exact: true })
      .click();
    track = boardRegion.locator('[data-story-time-track="true"]');
    await expect(track).toBeVisible();
    await expect(
      boardRegion.locator('[data-story-time-unassigned="true"]'),
    ).toHaveCount(0);
    await expect(
      boardRegion.locator('[data-story-time-stack-level="1"]'),
    ).toHaveCount(1);
    expect((await readBoard(page)).lanes[0]!.placements.map(
      (placement) => placement.storyTime,
    )).toEqual([firstPreviewValue, secondPreviewValue, thirdPreviewValue]);

    const staleBoard = await readBoard(page);
    const staleFirst = staleBoard.lanes[0]!.placements[0]!;
    const authoritative = await page.evaluate(
      async ({
        workId,
        plotPlacementId,
        plotBoardId,
        expectedPlacementRevision,
        expectedBoardRevision,
      }) => window.eumStudio.plots.setStoryTime({
        schemaVersion: 1,
        workId,
        plotPlacementId,
        plotBoardId,
        storyTime: 82.8125,
        storyTimeEnd: null,
        expectedPlacementRevision,
        expectedBoardRevision,
      }),
      {
        workId: staleBoard.workId,
        plotPlacementId: staleFirst.plotPlacementId,
        plotBoardId: staleBoard.plotBoardId,
        expectedPlacementRevision: staleFirst.revision,
        expectedBoardRevision: staleBoard.revision,
      },
    );
    expect(authoritative.lanes[0]!.placements[0]!.storyTime).toBe(82.8125);

    const staleSecondCard = boardRegion
      .locator('.plot-story-time-card')
      .filter({ hasText: plotTitles[1] });
    await dragToFraction(page, staleSecondCard, track, 0.6125);
    await expect(
      boardRegion.locator('[data-story-time-preview="true"]'),
    ).toHaveCount(1);
    await page.mouse.up();
    await expect(plotDialog.getByRole("alert")).toHaveText(
      "플롯 이야기 시간이 달라졌습니다. 다시 열어 확인하세요.",
    );
    await expect(boardRegion).toHaveAttribute("data-drag-active", "false");
    await expect(staleSecondCard).toHaveAttribute(
      "data-story-time",
      String(secondPreviewValue),
    );
    const boardAfterConflict = await readBoard(page);
    expect(boardAfterConflict).toEqual(authoritative);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    expect((await readBoard(page)).lanes[0]!.placements.map(
      (placement) => placement.storyTime,
    )).toEqual([82.8125, secondPreviewValue, thirdPreviewValue]);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("adds scenes and events from the manuscript right-click menu", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-manuscript-context-menu-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `원고 우클릭 ${suffix}`;
  const documentTitle = `회차 ${suffix}`;
  const prefix = "도입 ";
  const exactText = `사건 범위 ${suffix}`;
  const manuscriptText = `${prefix}${exactText} 마무리`;
  const eventTitle = `우클릭 사건 ${suffix}`;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const rightClickOffset = async (
    page: Page,
    manuscript: Locator,
    offset: number,
  ) => {
    const point = await manuscript.locator(".cm-line").first().evaluate(
      (line, targetOffset) => {
        const textNode = line.firstChild;
        if (!(textNode instanceof Text)) {
          throw new Error("CodeMirror line text node is missing");
        }
        const range = document.createRange();
        range.setStart(textNode, targetOffset);
        range.setEnd(textNode, Math.min(targetOffset + 1, textNode.length));
        const rectangle = range.getBoundingClientRect();
        return {
          x: rectangle.left + Math.max(1, rectangle.width / 2),
          y: rectangle.top + rectangle.height / 2,
        };
      },
      offset,
    );
    await page.mouse.click(point.x, point.y, { button: "right" });
  };

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog.getByRole("button", {
      name: "작품 만들기",
      exact: true,
    }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await rightClickOffset(page, manuscript, prefix.length + 1);
    let contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByRole("menuitem")).toHaveText([
      "장면 추가",
      "사건 추가",
    ]);
    await contextMenu.getByRole("menuitem", {
      name: "장면 추가",
      exact: true,
    }).click();
    await expect.poll(async () => page.evaluate(async () => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) return 0;
      return (await window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId: catalog.activeWorkId,
      })).scenes.length;
    })).toBe(2);

    await manuscript.press("Control+Home");
    for (let index = 0; index < prefix.length; index += 1) {
      await manuscript.press("ArrowRight");
    }
    for (let index = 0; index < exactText.length; index += 1) {
      await manuscript.press("Shift+ArrowRight");
    }
    await rightClickOffset(page, manuscript, prefix.length + 1);
    contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await contextMenu.getByRole("menuitem", {
      name: "사건 추가",
      exact: true,
    }).click();
    const eventDialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await expect(eventDialog).toContainText(exactText);
    await eventDialog.getByLabel("사건 제목").fill(eventTitle);
    await eventDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.getByRole("region", { name: "사건 레일" }))
      .toContainText(eventTitle);

    await manuscript.press("ArrowRight");
    await rightClickOffset(page, manuscript, prefix.length + 1);
    contextMenu = page.getByRole("menu", { name: "원고 우클릭 메뉴" });
    await contextMenu.getByRole("menuitem", {
      name: "사건 추가",
      exact: true,
    }).click();
    const plannedDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await expect(plannedDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(plannedDialog).toBeHidden();
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("opens and closes an empty Work event rail", async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-empty-event-rail-e2e-"),
  );
  const electronApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "1",
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });

  try {
    const page = await openStudioWorkspace(electronApp);
    const eventRail = page.getByRole("region", { name: "사건 레일" });
    const toggle = eventRail.getByRole("button", {
      name: "사건 레일 펼치기",
      exact: true,
    });
    await expect(toggle).toBeEnabled();
    const collapsedHeight = await eventRail.evaluate(
      (element) => element.getBoundingClientRect().height,
    );

    await toggle.click();
    await expect(eventRail).toHaveClass(/is-expanded/u);
    await expect(eventRail).toContainText("저장된 사건이 없습니다.");
    await expect(eventRail.getByRole("button", {
      name: "사건 레일 접기",
      exact: true,
    })).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => eventRail.evaluate(
      (element) => element.getBoundingClientRect().height,
    )).toBeGreaterThan(collapsedHeight);

    await eventRail.getByRole("button", {
      name: "사건 레일 접기",
      exact: true,
    }).click();
    await expect(eventRail).not.toHaveClass(/is-expanded/u);
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("renders the Work-global event rail below the editor with exact navigation", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-event-rail-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `사건 레일 작품-${suffix}`;
  const firstDocumentTitle = `첫 회차-${suffix}`;
  const secondDocumentTitle = `둘째 회차-${suffix}`;
  const firstEventTitle = `첫 원고 사건-${suffix}`;
  const secondEventTitle = `둘째 원고 사건-${suffix}`;
  const plannedEventTitle = `예정 사건-${suffix}`;
  const firstPrefix = "첫 회차 도입 ";
  const firstQuote = `첫 회차 정확 근거 ${suffix}`;
  const firstText = `${firstPrefix}${firstQuote} 마무리`;
  const secondPrefix = "";
  const secondQuote = `둘째 회차 정확 근거 ${suffix}`;
  const secondText = `${secondQuote} 끝`;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const readSelectedManuscriptText = async (manuscript: Locator) => {
    const host = manuscript.locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' manuscript-editor ')]",
    );
    const [text, selection] = await Promise.all([
      readEditorText(manuscript),
      host.evaluate((element) => ({
        anchor: Number((element as HTMLElement).dataset.selectionAnchor),
        head: Number((element as HTMLElement).dataset.selectionHead),
      })),
    ]);
    return text.slice(
      Math.min(selection.anchor, selection.head),
      Math.max(selection.anchor, selection.head),
    );
  };

  const selectExactRange = async (
    page: Page,
    manuscript: Locator,
    from: number,
    text: string,
  ) => {
    const points = await manuscript.locator(".cm-line").first().evaluate(
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
      { from, to: from + text.length },
    );
    await page.mouse.move(points.start.x, points.start.y);
    await page.mouse.down();
    await page.mouse.move(points.end.x, points.end.y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => readSelectedManuscriptText(manuscript)).toBe(text);
  };
  const createSelectedEvent = async (
    page: Page,
    manuscript: Locator,
    from: number,
    quote: string,
    title: string,
  ) => {
    await selectExactRange(page, manuscript, from, quote);
    await page
      .getByRole("button", { name: "사건으로 등록", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "사건으로 등록" });
    await dialog.getByLabel("사건 제목").fill(title);
    await dialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  const readRail = async (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.structure.listEventRail({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(firstDocumentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      firstDocumentTitle,
    );
    await manuscript.click();
    await manuscript.pressSequentially(firstText);
    await expectEditorText(manuscript, firstText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await createSelectedEvent(
      page,
      manuscript,
      firstPrefix.length,
      firstQuote,
      firstEventTitle,
    );

    await createNamedEpisode(page, secondDocumentTitle);
    await expect(page.getByTestId("manuscript-title")).toHaveText(
      secondDocumentTitle,
    );
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(secondText);
    await expectEditorText(manuscript, secondText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    await page.evaluate(
      async ({ title, exactQuote, from }) => {
        const catalog = await window.eumStudio.workspace.getCatalog();
        if (
          catalog.activeWorkId === null ||
          catalog.activeDocumentId === null
        ) {
          throw new Error("Expected an active Work and Document");
        }
        return window.eumStudio.structure.createEventBlock({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
          documentId: catalog.activeDocumentId,
          selection: { anchor: from, head: from + exactQuote.length },
          exactQuote,
          title,
          note: "",
        });
      },
      {
        title: secondEventTitle,
        exactQuote: secondQuote,
        from: secondPrefix.length,
      },
    );

    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    const plannedDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await plannedDialog.getByLabel("사건 제목").fill(plannedEventTitle);
    await plannedDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(plannedDialog).toBeHidden();

    let eventRegion = page.getByRole("region", { name: "사건 레일" });
    const eventCards = eventRegion.locator(".bottom-event-card");
    await expect(eventCards).toHaveCount(3);
    await expect(eventCards).toHaveText([
      new RegExp(firstEventTitle),
      new RegExp(secondEventTitle),
      new RegExp(plannedEventTitle),
    ]);
    const firstEventCard = eventCards.filter({ hasText: firstEventTitle });
    const secondEventCard = eventCards.filter({ hasText: secondEventTitle });
    const plannedEventCard = eventCards.filter({ hasText: plannedEventTitle });
    await expect(firstEventCard).toContainText(firstDocumentTitle);
    await expect(secondEventCard).toContainText(secondDocumentTitle);
    await expect(plannedEventCard).toContainText("미배치");
    await expect(plannedEventCard).toHaveAttribute(
      "data-source-navigable",
      "false",
    );
    await expect(plannedEventCard).toHaveAttribute("draggable", "true");
    await expect(plannedEventCard).toBeEnabled();

    await plannedEventCard.dragTo(firstEventCard, {
      targetPosition: { x: 2, y: 12 },
    });
    await expect(eventCards).toHaveText([
      new RegExp(plannedEventTitle),
      new RegExp(firstEventTitle),
      new RegExp(secondEventTitle),
    ]);

    await firstEventCard.click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(firstDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readSelectedManuscriptText(manuscript)).toBe(
      firstQuote,
    );
    await secondEventCard.click();
    await expect(page.getByTestId("manuscript-title")).toHaveText(secondDocumentTitle);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await expect.poll(() => readSelectedManuscriptText(manuscript)).toBe(
      secondQuote,
    );
    const railProjection = await readRail(page);
    expect(railProjection.eventBlocks).toHaveLength(3);
    expect(railProjection.eventBlocks.map((event) => event.title)).toEqual([
      plannedEventTitle,
      firstEventTitle,
      secondEventTitle,
    ]);
    expect(railProjection.manuscriptEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([firstEventTitle, secondEventTitle]);
    expect(railProjection.unpositionedEvents.map(
      (event) => event.eventBlock.title,
    )).toEqual([plannedEventTitle]);
    expect(railProjection.plotEventLinks).toHaveLength(0);

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    eventRegion = page.getByRole("region", { name: "사건 레일" });
    await expect(eventRegion.locator(".bottom-event-card")).toHaveText([
      new RegExp(plannedEventTitle),
      new RegExp(firstEventTitle),
      new RegExp(secondEventTitle),
    ]);
    const restartedRail = await readRail(page);
    expect(restartedRail.eventSources.map(
      (source) => source.anchors[0]?.exactQuote,
    )).toEqual(expect.arrayContaining([firstQuote, secondQuote]));
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});

test("projects final scenes from configured rules, folded overrides, and event exceptions across restart", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-studio-scene-projection-e2e-"),
  );
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `장면 projection 작품-${suffix}`;
  const documentTitle = `장면 회차-${suffix}`;
  const firstEventTitle = `첫 장면 사건-${suffix}`;
  const secondEventTitle = `둘째 장면 사건-${suffix}`;
  const plannedEventTitle = `미배정 예정 사건-${suffix}`;
  const firstQuote = `첫 사건 ${suffix}`;
  const secondQuote = `둘째 사건 ${suffix}`;
  const manuscriptText = `${firstQuote}\n***\n${secondQuote}`;
  const separatorFrom = manuscriptText.indexOf("***");
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  const runtimeEnvironment = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  let electronApp = await electron.launch({
    args: electronArguments,
    cwd: process.cwd(),
    env: runtimeEnvironment,
  });

  const readProjection = (page: Page) => page.evaluate(async () => {
    const catalog = await window.eumStudio.workspace.getCatalog();
    if (catalog.activeWorkId === null) throw new Error("Expected an active Work");
    return window.eumStudio.structure.listSceneProjection({
      schemaVersion: 1,
      workId: catalog.activeWorkId,
    });
  });

  try {
    let page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWorkDialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWorkDialog.getByLabel("작품 제목").fill(workTitle);
    await createWorkDialog.getByLabel("첫 회차 제목").fill(documentTitle);
    await createWorkDialog
      .getByRole("button", { name: "작품 만들기", exact: true })
      .click();
    await openReviewRail(page);

    let manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.pressSequentially(manuscriptText);
    await expectEditorText(manuscript, manuscriptText);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    await page.evaluate(
      async ({ firstQuote, firstEventTitle, secondQuote, secondEventTitle }) => {
        const catalog = await window.eumStudio.workspace.getCatalog();
        if (
          catalog.activeWorkId === null ||
          catalog.activeDocumentId === null
        ) {
          throw new Error("Expected an active Work and Document");
        }
        await window.eumStudio.structure.createEventBlock({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
          documentId: catalog.activeDocumentId,
          selection: { anchor: 0, head: firstQuote.length },
          exactQuote: firstQuote,
          title: firstEventTitle,
          note: "",
        });
        const secondFrom = `${firstQuote}\n***\n`.length;
        await window.eumStudio.structure.createEventBlock({
          schemaVersion: 1,
          workId: catalog.activeWorkId,
          documentId: catalog.activeDocumentId,
          selection: {
            anchor: secondFrom,
            head: secondFrom + secondQuote.length,
          },
          exactQuote: secondQuote,
          title: secondEventTitle,
          note: "",
        });
      },
      { firstQuote, firstEventTitle, secondQuote, secondEventTitle },
    );
    await page
      .getByRole("button", { name: "예정 사건 추가", exact: true })
      .click();
    const plannedDialog = page.getByRole("dialog", { name: "예정 사건 추가" });
    await plannedDialog.getByLabel("사건 제목").fill(plannedEventTitle);
    await plannedDialog.getByRole("button", { name: "등록", exact: true }).click();
    await expect(plannedDialog).toBeHidden();

    let sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    let sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    await expect(sceneCards.nth(0)).toContainText(firstEventTitle);
    await expect(sceneCards.nth(0)).toContainText("자동 소속");
    await expect(sceneCards.nth(1)).toContainText(secondEventTitle);
    await expect(sceneRegion.locator(".scene-unassigned-summary"))
      .toContainText(plannedEventTitle);

    await sceneRegion.getByText("장면 규칙 설정", { exact: true }).click();
    let rulePattern = sceneRegion.getByLabel("장면 규칙 1 정규식");
    await expect(rulePattern).toHaveValue("^\\s*\\*\\*\\*\\s*$");
    await rulePattern.fill("^\\s*---\\s*$");
    await sceneRegion
      .getByRole("button", { name: "규칙 저장", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(1);
    rulePattern = sceneRegion.getByLabel("장면 규칙 1 정규식");
    await rulePattern.fill("^\\s*\\*\\*\\*\\s*$");
    await sceneRegion
      .getByRole("button", { name: "규칙 저장", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(2);

    await sceneCards.nth(1)
      .getByRole("button", { name: "앞 장면과 병합", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(1);
    manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.click();
    await manuscript.press("Control+Home");
    for (let index = 0; index < separatorFrom; index += 1) {
      await manuscript.press("ArrowRight");
    }
    await sceneCards.nth(0)
      .getByRole("button", { name: "현재 위치에서 분할", exact: true })
      .click();
    await expect(sceneCards).toHaveCount(2);
    await expect(sceneCards.nth(0)).toContainText(firstEventTitle);
    await expect(sceneCards.nth(1)).toContainText(secondEventTitle);
    await expect(sceneCards.nth(0)).toContainText("수동 조정 반영");

    const secondSceneUnassigned = sceneCards.nth(1)
      .locator(".scene-unassigned-events");
    await secondSceneUnassigned.locator("summary").click();
    await secondSceneUnassigned.locator("li")
      .filter({ hasText: plannedEventTitle })
      .getByRole("button", { name: "이 장면에 포함", exact: true })
      .click();
    await expect(sceneCards.nth(1)).toContainText(plannedEventTitle);
    await expect(sceneCards.nth(1)).toContainText("수동 포함");

    await sceneCards.nth(0)
      .getByRole("button", { name: "수동 제외", exact: true })
      .click();
    await expect(sceneCards.nth(0).locator(".scene-excluded-events"))
      .toContainText(firstEventTitle);
    await expect(sceneCards.nth(0))
      .toContainText("제외 해제");

    const beforeRestart = await readProjection(page);
    expect(beforeRestart.status).toBe("clean");
    expect(beforeRestart.ruleSet).toMatchObject({
      revision: 3,
      boundaryRules: [{ pattern: "^\\s*\\*\\*\\*\\s*$", flags: "u" }],
    });
    expect(beforeRestart.scenes).toHaveLength(2);
    expect(beforeRestart.sceneEventOverrides).toHaveLength(2);
    expect(beforeRestart.scenes[0]?.excludedEvents).toMatchObject([
      { title: firstEventTitle },
    ]);
    expect(beforeRestart.scenes[1]?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: secondEventTitle, membership: "automatic" }),
      expect.objectContaining({ title: plannedEventTitle, membership: "manual" }),
    ]));

    await electronApp.close();
    electronApp = await electron.launch({
      args: electronArguments,
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });
    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByText(workTitle, { exact: true }).first()).toBeVisible();
    await continueFromMain(page);
    await openReviewRail(page);
    sceneRegion = page.getByRole("region", { name: "현재 회차 장면" });
    sceneCards = sceneRegion.locator(".scene-list-card");
    await expect(sceneCards).toHaveCount(2);
    await expect(sceneCards.nth(0).locator(".scene-excluded-events"))
      .toContainText(firstEventTitle);
    await expect(sceneCards.nth(1)).toContainText(plannedEventTitle);
    expect(await readProjection(page)).toEqual(beforeRestart);

    await sceneCards.nth(1).locator(".scene-list-open-button").click();
    await expect.poll(() =>
      page.locator(".manuscript-editor").evaluate((element) => ({
        anchor: Number(element.getAttribute("data-selection-anchor")),
        head: Number(element.getAttribute("data-selection-head")),
      })),
    ).toEqual({ anchor: separatorFrom, head: manuscriptText.length });
  } finally {
    await electronApp.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
