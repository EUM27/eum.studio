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
  readdir,
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
import { _electron as nativeElectron } from "playwright";

// Every launch without a caller-selected profile stays inside this test's
// output directory, including restarts and runtime capability probes.
const electron: Pick<typeof nativeElectron, "launch"> = {
  launch: async (options = {}) => {
    const args = [...(options.args ?? [])];
    if (!args.some((argument) => argument === "--user-data-dir" || argument.startsWith("--user-data-dir="))) {
      args.push(`--user-data-dir=${test.info().outputPath("electron-user-data")}`);
    }
    const executablePath = options.executablePath ?? process.env.EUM_STUDIO_E2E_EXECUTABLE_PATH;
    if (executablePath !== undefined && !path.isAbsolute(executablePath)) {
      throw new Error("The selected E2E executable path must be absolute");
    }
    return nativeElectron.launch({ ...options, args, ...(executablePath === undefined ? {} : { executablePath }) });
  },
};

import { parseManuscriptInputProfile } from "../../../src/application/editor/manuscript-input-profile";
import { getPreviousEpisodeFlowPreviewText } from "../../../src/application/editor/previous-episode-flow";
import {
  CreateAnchor,
} from "../../../src/application/anchors/create-anchor";
import {
  CaptureResumeCheckpoint,
} from "../../../src/application/checkpoints/capture-resume-checkpoint";
import { applyChangeBatch } from "../../../src/application/persistence/apply-change-batch";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  encodeDurableText,
  parseCanonicalChangeBatch,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
} from "../../../src/application/persistence/change-batch";
import { appendJournalPayloadDurably } from "../../../src/platform/journal/append-only-journal";
import { scanJournalFrames } from "../../../src/platform/journal/journal-frame";
import { createNodeCryptoJournalChecksumAdapter } from "../../../src/platform/journal/node-crypto-journal-checksum";
import {
  createNodeCryptoAnchorEvidenceDescriptor,
} from "../../../src/platform/anchors/node-crypto-anchor-evidence";
import {
  createPocResumeCheckpointCaptureTransaction,
} from "../../../src/platform/checkpoints/poc-resume-checkpoint-publication";
import {
  createJsonPocResumeCheckpointPublicationCodec,
} from "../../../src/platform/checkpoints/poc-resume-checkpoint-json-codec";
import {
  InMemoryRevisionStore,
} from "../../../src/platform/revisions/in-memory-revision-store";
import {
  createWritingCatalog,
  entityId,
  type DocumentRevision,
  type ResumeCheckpoint,
  type Work,
} from "../../../src/domain/writing";
import { parseLongformFixtureManifest } from "../../fixtures/longform/longform-fixture";

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
      __youtubePlayerEnd?: () => void;
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
          testWindow.__youtubePlayerEnd = () => {
            this.events.onStateChange({ data: 0 });
          };
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
  const manuscript = page.getByRole("textbox", { name: "원고" });
  if (!(await manuscript.isVisible())) {
    await openWorkSection(page, "쓰기");
  }
  await expect(manuscript).toBeVisible();
  if ((await page.getByTestId("manuscript-title").textContent()) !== documentTitle) {
    await activateDocumentFromTree(page, documentTitle);
  }
}

function documentTreeButton(page: Page, documentTitle: string): Locator {
  return page
    .getByRole("region", { name: "회차 폴더" })
    .locator(".document-tree-open")
    .filter({ hasText: documentTitle });
}

async function activateDocumentFromTree(
  page: Page,
  documentTitle: string,
): Promise<void> {
  await documentTreeButton(page, documentTitle).click();
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
  const directory = await mkdtemp(
    path.join(tmpdir(), "eum-electron-hash-discovery-"),
  );
  const discoveryApp = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "1",
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
      EUM_STUDIO_DISABLE_SANDBOX: "1",
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
    await removeVerifiedTemporaryDirectory(directory);
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


export {
  createHash,
  randomInt,
  randomUUID,
  readFileSync,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  tmpdir,
  createServer,
  path,
  DatabaseSync,
  expect,
  test,
  electron,
  parseManuscriptInputProfile,
  getPreviousEpisodeFlowPreviewText,
  CreateAnchor,
  CaptureResumeCheckpoint,
  applyChangeBatch,
  DURABLE_TEXT_REPRESENTATION_V1,
  encodeDurableText,
  parseCanonicalChangeBatch,
  parseChangeBatch,
  serializeCanonicalChangeBatch,
  appendJournalPayloadDurably,
  scanJournalFrames,
  createNodeCryptoJournalChecksumAdapter,
  createNodeCryptoAnchorEvidenceDescriptor,
  createPocResumeCheckpointCaptureTransaction,
  createJsonPocResumeCheckpointPublicationCodec,
  InMemoryRevisionStore,
  createWritingCatalog,
  entityId,
  parseLongformFixtureManifest,
  openPublishingFromLibrary,
  readJsonFixture,
  readHangulCompositionText,
  openStudioWorkspace,
  installFakeYouTubePlayer,
  installFakePomodoroAlertAudio,
  continueFromMain,
  openStudioHome,
  openReviewRail,
  openAssistantContext,
  openWorkSection,
  openStructureTab,
  openReviewTab,
  openWritingRecords,
  openLoreCandidateInbox,
  openSchedule,
  openWorkDocumentFromHome,
  documentTreeButton,
  activateDocumentFromTree,
  createNamedEpisode,
  readActiveDocumentId,
  expectEditorText,
  readEditorText,
  expectDialogFitsDesktop,
  selectElectronRuntimeHashAlgorithm,
  removeVerifiedTemporaryDirectory,
  createDocumentSwitchProfile,
  createStartupRecoveryFixture,
  createResumeRecoveryFixture,
};
export type {
  Locator,
  Page,
  RunningElectronApp,
  DocumentRevision,
  ResumeCheckpoint,
  Work,
};
