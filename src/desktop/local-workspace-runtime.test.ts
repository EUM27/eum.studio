import {
  randomUUID,
} from "node:crypto";
import { readFileSync } from "node:fs";
import {
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import {
  parseManuscriptDocumentProfile,
} from "../application/editor/manuscript-document-profile";
import {
  parseManuscriptEditorDocumentState,
  parseManuscriptFormattingProfile,
  serializeManuscriptEditorDocumentState,
} from "../application/editor/manuscript-formatting";
import {
  parseManuscriptPreflightProfile,
} from "../application/editor/manuscript-preflight";
import { parseFragmentShelfProfile } from "../application/fragments/fragment-contract";
import { parseForeshadowPointProfile } from "../application/foreshadowing/foreshadow-point-contract";
import {
  DURABLE_TEXT_REPRESENTATION_V1,
  parseChangeBatch,
} from "../application/persistence/change-batch";
import {
  parseManuscriptBatchingPolicy,
} from "../application/persistence/manuscript-persistence-profile";
import {
  createLocalWorkspaceStorageProfiles,
  openLocalWorkspaceRuntime,
  type LocalWorkspaceRuntimeOptions,
} from "./local-workspace-runtime";
import {
  parseLocalWorkspaceDefaults,
} from "../application/workspace/local-workspace-defaults";
import {
  parseLocalWorkspaceBackupProfile,
} from "../application/storage/local-workspace-backup-profile";
import { parseAppSettingsProfile } from "../application/settings/app-settings";
import { parseAssistantDestinationProfile } from "../application/assistant/assistant-destination-profile";
import { parseMusicSettingsProfile } from "../application/music/work-music-settings";
import { entityId } from "../domain/writing";

function createOptions(rootDirectoryPath: string) {
  const workId = randomUUID();
  const documentId = randomUUID();
  return {
    rootDirectoryPath,
    studioDisplayName: randomUUID(),
    locale: "ko-KR",
    timezone: "Asia/Seoul",
    batchingPolicy: parseManuscriptBatchingPolicy({
      schemaVersion: 1,
      maxTransactionsPerBatch: 1,
      maxDelayMs: 0,
    }),
    formattingProfile: parseManuscriptFormattingProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "manuscript-formatting.json",
          ),
          "utf8",
        ),
      ),
    ),
    appSettingsProfile: parseAppSettingsProfile(
      JSON.parse(
        readFileSync(
          path.join(process.cwd(), "config", "app-settings.json"),
          "utf8",
        ),
      ),
    ),
    musicSettingsProfile: parseMusicSettingsProfile({
      schemaVersion: 1,
      workDefaults: {
        autoOnEpisodeTransition: false,
        autoOnSceneTransition: false,
        autoPlayOnPomodoroStart: true,
        preciseSelection: false,
        transitionPlaybackMode: "restart",
      },
      transitionPlaybackModes: ["restart", "ask"],
    }),
    preflightProfile: parseManuscriptPreflightProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "manuscript-preflight.json",
          ),
          "utf8",
        ),
      ),
    ),
    fragmentProfile: parseFragmentShelfProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "fragment-shelf.json",
          ),
          "utf8",
        ),
      ),
    ),
    foreshadowPointProfile: parseForeshadowPointProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "foreshadowing.json",
          ),
          "utf8",
        ),
      ),
    ),
    emptyDocumentProfile: parseManuscriptDocumentProfile({
      schemaVersion: 1,
      initialDocumentId: documentId,
      documents: [
        {
          workId,
          documentId,
          documentRevisionId: randomUUID(),
          label: randomUUID(),
          initialText: "",
        },
      ],
    }),
    defaults: parseLocalWorkspaceDefaults(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "local-workspace-defaults.json",
          ),
          "utf8",
        ),
      ),
    ),
    backupProfile: parseLocalWorkspaceBackupProfile(
      JSON.parse(
        readFileSync(
          path.join(
            process.cwd(),
            "config",
            "local-workspace-backup.json",
          ),
          "utf8",
        ),
      ),
    ),
  } as const;
}

describe("local workspace runtime", () => {
  it("prepares only the selected Work records period without changing the ledger", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-record-export-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    const runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "첫 작품",
        firstDocumentTitle: "첫 회차",
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: "둘째 작품",
        firstDocumentTitle: "둘째 회차",
      });
      const firstStarted = await runtime.startWritingSession({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        note: "첫 기록",
      });
      if (firstStarted.activeSessionId === null) {
        throw new Error("Expected the first WritingSession");
      }
      await runtime.stopWritingSession({
        schemaVersion: 1,
        workId: first.workId,
        sessionId: firstStarted.activeSessionId,
      });
      const secondStarted = await runtime.startWritingSession({
        schemaVersion: 1,
        workId: second.workId,
        documentId: second.documentId,
        note: "둘째 기록",
      });
      if (secondStarted.activeSessionId === null) {
        throw new Error("Expected the second WritingSession");
      }
      await runtime.stopWritingSession({
        schemaVersion: 1,
        workId: second.workId,
        sessionId: secondStarted.activeSessionId,
      });

      const before = await runtime.listWorkActivity({
        schemaVersion: 1,
        workId: first.workId,
      });
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: options.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const prepared = await runtime.prepareWorkRecordsExport({
        schemaVersion: 1,
        workId: first.workId,
        format: "json",
        fromDate: today,
        toDate: today,
      });
      const exported = JSON.parse(prepared.text) as {
        work: { workId: string; title: string };
        sessions: Array<{
          documentId: string;
          documentTitle: string;
          note: string;
        }>;
      };

      expect(exported.work).toEqual({ workId: first.workId, title: "첫 작품" });
      expect(exported.sessions).toEqual([
        expect.objectContaining({
          documentId: first.documentId,
          documentTitle: "첫 회차",
          note: "첫 기록",
        }),
      ]);
      expect(prepared.text).not.toContain(second.workId);
      expect(prepared.text).not.toContain("둘째 기록");
      await expect(
        runtime.listWorkActivity({ schemaVersion: 1, workId: first.workId }),
      ).resolves.toEqual(before);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned writing goals with stale revision protection", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-record-goals-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const initial = await runtime.getWorkRecordsGoals({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(initial).toEqual({
        schemaVersion: 1,
        workId: first.workId,
        revision: 0,
        goals: {
          dailyActiveMinutes: null,
          dailyCharacters: null,
          weeklyActiveMinutes: null,
          weeklyCharacters: null,
        },
      });

      const saved = await runtime.saveWorkRecordsGoals({
        schemaVersion: 1,
        workId: first.workId,
        expectedRevision: initial.revision,
        goals: {
          dailyActiveMinutes: 45,
          dailyCharacters: 1_500,
          weeklyActiveMinutes: null,
          weeklyCharacters: 8_000,
        },
      });
      expect(saved).toMatchObject({
        workId: first.workId,
        revision: 1,
        goals: {
          dailyActiveMinutes: 45,
          dailyCharacters: 1_500,
          weeklyActiveMinutes: null,
          weeklyCharacters: 8_000,
        },
      });
      await expect(
        runtime.saveWorkRecordsGoals({
          schemaVersion: 1,
          workId: first.workId,
          expectedRevision: 0,
          goals: saved.goals,
        }),
      ).rejects.toThrow(/revision conflict/u);
      expect(
        await runtime.getWorkRecordsGoals({
          schemaVersion: 1,
          workId: second.workId,
        }),
      ).toMatchObject({
        revision: 0,
        goals: {
          dailyActiveMinutes: null,
          dailyCharacters: null,
          weeklyActiveMinutes: null,
          weeklyCharacters: null,
        },
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      await expect(
        runtime.getWorkRecordsGoals({
          schemaVersion: 1,
          workId: first.workId,
        }),
      ).resolves.toEqual(saved);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned readthrough counts across a full runtime restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-readthrough-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "2화",
      });
      const initial = await runtime.getWorkReadthrough({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(initial).toEqual({
        schemaVersion: 1,
        workId: first.workId,
        revision: 0,
        entries: [],
      });

      const saved = await runtime.saveWorkReadthrough({
        schemaVersion: 1,
        workId: first.workId,
        expectedRevision: initial.revision,
        entries: [
          { documentId: first.documentId, readerCount: 1_000 },
          { documentId: second.documentId, readerCount: 800 },
        ],
      });
      expect(saved).toMatchObject({
        workId: first.workId,
        revision: 1,
        entries: [
          { documentId: first.documentId, readerCount: 1_000 },
          { documentId: second.documentId, readerCount: 800 },
        ],
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      await expect(
        runtime.getWorkReadthrough({
          schemaVersion: 1,
          workId: first.workId,
        }),
      ).resolves.toEqual(saved);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists an exact Work continuous-reading position across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-continuous-reading-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "2화",
      });
      const secondText = `첫 줄 ${randomUUID()}\n둘째 줄 ${randomUUID()}`;
      const secondReceipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: second.documentId,
          baseRevisionId: second.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: secondText.length,
          changes: [
            {
              fromUtf16: 0,
              toUtf16: 0,
              insertedText: secondText,
            },
          ],
        }),
      );
      if (!("revisionId" in secondReceipt)) {
        throw new Error("The local workspace save must return a revisionId");
      }
      const secondLineOffset = secondText.indexOf("\n") + 1;
      const initial = await runtime.getContinuousReadingProgress({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(initial).toEqual({
        schemaVersion: 1,
        workId: first.workId,
        revision: 0,
        location: null,
      });

      const saved = await runtime.saveContinuousReadingProgress({
        schemaVersion: 1,
        workId: first.workId,
        expectedRevision: initial.revision,
        location: {
          documentId: second.documentId,
          documentRevisionId: secondReceipt.revisionId,
          textOffset: secondLineOffset,
        },
      });
      expect(saved).toMatchObject({
        workId: first.workId,
        revision: 1,
        location: {
          documentId: second.documentId,
          documentRevisionId: secondReceipt.revisionId,
          textOffset: secondLineOffset,
        },
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      await expect(
        runtime.getContinuousReadingProgress({
          schemaVersion: 1,
          workId: first.workId,
        }),
      ).resolves.toEqual(saved);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned preflight settings and validates exact export ownership", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-preflight-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const initial = await runtime.getManuscriptPreflightSettings({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(initial).toEqual({
        schemaVersion: 1,
        workId: first.workId,
        revision: 0,
        settings: options.preflightProfile.defaults,
      });

      const saved = await runtime.saveManuscriptPreflightSettings({
        schemaVersion: 1,
        workId: first.workId,
        settings: {
          ...initial.settings,
          tabReplacement: "spaces",
          tabWidth: options.preflightProfile.limits.tabWidth.max,
          forbiddenTerms: [randomUUID()],
        },
      });
      expect(saved).toMatchObject({
        workId: first.workId,
        revision: 1,
        settings: {
          tabReplacement: "spaces",
          tabWidth: options.preflightProfile.limits.tabWidth.max,
        },
      });
      expect(
        await runtime.getManuscriptPreflightSettings({
          schemaVersion: 1,
          workId: second.workId,
        }),
      ).toEqual({
        schemaVersion: 1,
        workId: second.workId,
        revision: 0,
        settings: options.preflightProfile.defaults,
      });

      const exportCommand = {
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        suggestedFileName: "승인 원고.txt",
        text: `승인된 원고 ${randomUUID()}`,
      } as const;
      await expect(runtime.prepareManuscriptTextExport(exportCommand)).resolves.toEqual(
        exportCommand,
      );
      await expect(
        runtime.prepareManuscriptTextExport({
          ...exportCommand,
          documentId: second.documentId,
        }),
      ).rejects.toThrow("Work/document boundary violation");

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(
        await runtime.getManuscriptPreflightSettings({
          schemaVersion: 1,
          workId: first.workId,
        }),
      ).toEqual(saved);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("stores exact manuscript formatting with the immutable revision and restores it after reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-formatting-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const text = "가나다라마바사";
      const firstEditorStateJson = JSON.stringify({
        schemaVersion: 1,
        ranges: [
          {
            from: 1,
            to: 4,
            style: { bold: true },
          },
        ],
        contentWidthPx: 640,
      });
      const canonicalFirstEditorStateJson =
        serializeManuscriptEditorDocumentState(
          parseManuscriptEditorDocumentState(
            JSON.parse(firstEditorStateJson),
            options.formattingProfile,
            text.length,
          ),
        );
      const textReceipt = await runtime.saveDocumentChange({
        schemaVersion: 1,
        batch: parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: text.length,
          changes: [
            { fromUtf16: 0, toUtf16: 0, insertedText: text },
          ],
        }),
        editorStateJson: firstEditorStateJson,
      });
      if (!("revisionId" in textReceipt)) {
        throw new Error("Local revision save did not return a revision identity");
      }
      const finalEditorStateJson = JSON.stringify({
        schemaVersion: 1,
        ranges: [
          {
            from: 1,
            to: 4,
            style: { bold: true, italic: true, underline: true },
          },
        ],
        contentWidthPx: 800,
      });
      const canonicalFinalEditorStateJson =
        serializeManuscriptEditorDocumentState(
          parseManuscriptEditorDocumentState(
            JSON.parse(finalEditorStateJson),
            options.formattingProfile,
            text.length,
          ),
        );
      const formattingReceipt = await runtime.saveFormatting({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        expectedCurrentRevisionId: textReceipt.revisionId,
        editorStateJson: finalEditorStateJson,
      });

      expect(runtime.getManuscriptDocumentProfile().documents[0]).toMatchObject({
        documentRevisionId: formattingReceipt.revisionId,
        initialText: text,
        editorStateJson: canonicalFinalEditorStateJson,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(runtime.getManuscriptDocumentProfile().documents[0]).toMatchObject({
        documentRevisionId: formattingReceipt.revisionId,
        initialText: text,
        editorStateJson: canonicalFinalEditorStateJson,
      });

      await runtime.restoreDocumentRevision({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        targetRevisionId: textReceipt.revisionId,
      });
      expect(runtime.getManuscriptDocumentProfile().documents[0]).toMatchObject({
        initialText: text,
        editorStateJson: canonicalFirstEditorStateJson,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates a first Work, saves an immutable revision, and materializes it after reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-local-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    const title = randomUUID();
    const firstDocumentTitle = randomUUID();
    const insertedText = randomUUID();
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title,
        firstDocumentTitle,
      });
      const profile = runtime.getManuscriptDocumentProfile();
      expect(profile.initialDocumentId).toBe(created.documentId);
      expect(profile.documents[0]).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        documentRevisionId: created.revisionId,
        label: firstDocumentTitle,
        initialText: "",
      });

      const receipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: insertedText.length,
          changes: [
            {
              fromUtf16: 0,
              toUtf16: 0,
              insertedText,
            },
          ],
        }),
      );
      expect(receipt).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
      });
      expect(receipt).toHaveProperty("revisionId");

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = runtime.getManuscriptDocumentProfile();
      expect(reopened.documents[0]).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        label: firstDocumentTitle,
        initialText: insertedText,
      });
      expect(
        runtime.getWorkspaceCatalog().works[0],
      ).toMatchObject({
        workId: created.workId,
        title,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists the exact untitled label for blank first and additional Document titles", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-untitled-documents-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: " ",
      });
      const additional = await runtime.createDocument({
        schemaVersion: 1,
        workId: created.workId,
        title: "",
      });

      expect(
        runtime
          .getWorkspaceCatalog()
          .works[0]?.documents.map((document) => document.title),
      ).toEqual(["제목없음", "제목없음"]);
      expect(runtime.getWorkspaceCatalog().activeDocumentId).toBe(
        additional.documentId,
      );

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(
        runtime
          .getWorkspaceCatalog()
          .works[0]?.documents.map((document) => document.title),
      ).toEqual(["제목없음", "제목없음"]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("renames Work and Document metadata without replacing the manuscript revision", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-rename-workspace-metadata-"),
    );
    const options = createOptions(rootDirectoryPath);
    const workTitle = randomUUID();
    const documentTitle = randomUUID();
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const revisionId = runtime.getManuscriptDocumentProfile().documents[0]
        ?.documentRevisionId;

      await runtime.renameWork({
        schemaVersion: 1,
        workId: created.workId,
        title: `  ${workTitle}  `,
      });
      await runtime.renameDocument({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        title: `  ${documentTitle}  `,
      });

      expect(runtime.getWorkspaceCatalog().works[0]).toMatchObject({
        workId: created.workId,
        title: workTitle,
        documents: [
          {
            documentId: created.documentId,
            title: documentTitle,
            currentRevisionId: revisionId,
          },
        ],
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        documentId: created.documentId,
        documentRevisionId: revisionId,
        label: documentTitle,
        initialText: "",
      });

      const other = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await expect(
        runtime.renameDocument({
          schemaVersion: 1,
          workId: other.workId,
          documentId: created.documentId,
          title: randomUUID(),
        }),
      ).rejects.toThrow("Work/document boundary violation");

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = runtime
        .getWorkspaceCatalog()
        .works.find((work) => work.workId === created.workId);
      expect(reopened).toMatchObject({
        title: workTitle,
        documents: [
          {
            documentId: created.documentId,
            title: documentTitle,
            currentRevisionId: revisionId,
          },
        ],
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists exact Work favorites across runtime restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-favorites-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });

      expect(
        await runtime.setWorkFavorite({
          schemaVersion: 1,
          workId: first.workId,
          favorite: true,
        }),
      ).toEqual({ schemaVersion: 1, workIds: [first.workId] });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(runtime.getWorkFavorites()).toEqual({
        schemaVersion: 1,
        workIds: [first.workId],
      });

      await runtime.setWorkFavorite({
        schemaVersion: 1,
        workId: first.workId,
        favorite: false,
      });
      expect(runtime.getWorkFavorites()).toEqual({
        schemaVersion: 1,
        workIds: [],
      });
      await expect(
        runtime.setWorkFavorite({
          schemaVersion: 1,
          workId: entityId<"Work">(randomUUID()),
          favorite: true,
        }),
      ).rejects.toThrow("Unknown Work");
      expect(second.workId).not.toBe(first.workId);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists the exact Work-owned cover across runtime restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-cover-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const cover = {
        schemaVersion: 1,
        workId: created.workId,
        mediaType: "image/png",
        contentBase64: "aW1hZ2U=",
      } as const;

      await expect(runtime.saveWorkCover(cover)).resolves.toEqual(cover);
      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(runtime.getWorkCovers()).toEqual({
        schemaVersion: 1,
        covers: [cover],
      });
      await expect(
        runtime.saveWorkCover({
          ...cover,
          workId: entityId<"Work">(randomUUID()),
        }),
      ).rejects.toThrow("Unknown Work");
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("reorders Documents without changing their manuscript revisions or active location", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-reorder-document-metadata-"),
    );
    const options = createOptions(rootDirectoryPath);
    const titles = [randomUUID(), randomUUID(), randomUUID()] as const;
    const manuscript = `순서를 바꿔도 남는 원고 ${randomUUID()}`;
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: titles[0],
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: titles[1],
      });
      const secondSave = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: second.documentId,
          baseRevisionId: second.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      if (!("revisionId" in secondSave)) {
        throw new Error("Local workspace save must return a revision receipt");
      }
      const third = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: titles[2],
      });
      const originalRevisionByDocument = new Map(
        runtime.getManuscriptDocumentProfile().documents.map((document) => [
          document.documentId,
          document.documentRevisionId,
        ]),
      );

      const moved = await runtime.moveDocument({
        schemaVersion: 1,
        workId: first.workId,
        documentId: third.documentId,
        direction: "earlier",
      });
      const movedWork = moved.works.find((work) => work.workId === first.workId);
      expect(movedWork?.documents.map((document) => document.documentId)).toEqual([
        first.documentId,
        third.documentId,
        second.documentId,
      ]);
      expect(moved).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: third.documentId,
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents.map(
          (document) => document.documentId,
        ),
      ).toEqual([
        first.documentId,
        third.documentId,
        second.documentId,
      ]);
      const preservedSecond = runtime
        .getManuscriptDocumentProfile()
        .documents.find((document) => document.documentId === second.documentId);
      expect(preservedSecond).toMatchObject({
        documentRevisionId: secondSave.revisionId,
        initialText: manuscript,
      });
      expect(originalRevisionByDocument.get(first.documentId)).toBe(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === first.documentId,
        )?.documentRevisionId,
      );
      expect(originalRevisionByDocument.get(third.documentId)).toBe(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === third.documentId,
        )?.documentRevisionId,
      );

      const other = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await expect(
        runtime.moveDocument({
          schemaVersion: 1,
          workId: other.workId,
          documentId: second.documentId,
          direction: "earlier",
        }),
      ).rejects.toThrow("Work/document boundary violation");
      const afterNonactiveMove = await runtime.moveDocument({
        schemaVersion: 1,
        workId: first.workId,
        documentId: third.documentId,
        direction: "earlier",
      });
      expect(afterNonactiveMove).toMatchObject({
        activeWorkId: other.workId,
        activeDocumentId: other.documentId,
      });
      expect(
        afterNonactiveMove.works
          .find((work) => work.workId === first.workId)
          ?.documents.map((document) => document.documentId),
      ).toEqual([third.documentId, first.documentId, second.documentId]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(
        runtime
          .getWorkspaceCatalog()
          .works.find((work) => work.workId === first.workId)
          ?.documents.map((document) => document.documentId),
      ).toEqual([third.documentId, first.documentId, second.documentId]);
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === second.documentId,
        ),
      ).toMatchObject({
        documentRevisionId: secondSave.revisionId,
        initialText: manuscript,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("activates the requested Document after repeated resume capture and reordering", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-reorder-resume-activation-"),
    );
    const runtime = await openLocalWorkspaceRuntime(
      createOptions(rootDirectoryPath),
    );

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      const third = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      const captureThirdResume = () =>
        runtime.captureWorkspaceResume({
          schemaVersion: 1,
          workId: first.workId,
          documentId: third.documentId,
          selection: { anchor: 0, head: 0 },
          workspaceMode: "writing",
        });

      await captureThirdResume();
      await captureThirdResume();
      await runtime.moveDocument({
        schemaVersion: 1,
        workId: first.workId,
        documentId: third.documentId,
        direction: "earlier",
      });
      await captureThirdResume();

      const activated = await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: second.documentId,
      });

      expect(activated).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: second.documentId,
      });
      expect(runtime.getManuscriptDocumentProfile().initialDocumentId).toBe(
        second.documentId,
      );
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("organizes Documents in owned folders without changing manuscript revisions or active location", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-document-folders-"),
    );
    const options = createOptions(rootDirectoryPath);
    const rootTitle = randomUUID();
    const renamedRootTitle = randomUUID();
    const childTitle = randomUUID();
    const manuscript = `폴더를 바꿔도 남는 원고 ${randomUUID()}`;
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      const saved = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: second.documentId,
          baseRevisionId: second.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      if (!("revisionId" in saved)) {
        throw new Error("Local workspace save must return a revision receipt");
      }
      let catalog = await runtime.createDocumentFolder({
        schemaVersion: 1,
        workId: first.workId,
        title: rootTitle,
        parentFolderId: null,
      });
      const rootFolder = catalog.works
        .find((work) => work.workId === first.workId)
        ?.folders.find((folder) => folder.title === rootTitle);
      if (rootFolder === undefined) {
        throw new Error("Created root Document folder is missing");
      }
      catalog = await runtime.createDocumentFolder({
        schemaVersion: 1,
        workId: first.workId,
        title: childTitle,
        parentFolderId: rootFolder.folderId,
      });
      const childFolder = catalog.works
        .find((work) => work.workId === first.workId)
        ?.folders.find((folder) => folder.title === childTitle);
      if (childFolder === undefined) {
        throw new Error("Created child Document folder is missing");
      }
      await runtime.renameDocumentFolder({
        schemaVersion: 1,
        workId: first.workId,
        folderId: rootFolder.folderId,
        title: renamedRootTitle,
      });
      await runtime.placeDocumentInFolder({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        folderId: rootFolder.folderId,
      });
      await runtime.placeDocumentInFolder({
        schemaVersion: 1,
        workId: first.workId,
        documentId: second.documentId,
        folderId: childFolder.folderId,
      });

      const other = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await expect(
        runtime.placeDocumentInFolder({
          schemaVersion: 1,
          workId: other.workId,
          documentId: second.documentId,
          folderId: null,
        }),
      ).rejects.toThrow("Work/document boundary violation");
      await expect(
        runtime.createDocumentFolder({
          schemaVersion: 1,
          workId: other.workId,
          title: randomUUID(),
          parentFolderId: childFolder.folderId,
        }),
      ).rejects.toThrow("Work/folder boundary violation");

      const retired = await runtime.retireDocumentFolder({
        schemaVersion: 1,
        workId: first.workId,
        folderId: rootFolder.folderId,
      });
      expect(retired).toMatchObject({
        activeWorkId: other.workId,
        activeDocumentId: other.documentId,
      });
      const firstWork = retired.works.find(
        (work) => work.workId === first.workId,
      );
      expect(firstWork?.folders).toEqual([{
        folderId: childFolder.folderId,
        title: childTitle,
        parentFolderId: null,
      }]);
      expect(
        firstWork?.documents.find(
          (document) => document.documentId === first.documentId,
        )?.folderId,
      ).toBeNull();
      expect(
        firstWork?.documents.find(
          (document) => document.documentId === second.documentId,
        ),
      ).toMatchObject({
        currentRevisionId: saved.revisionId,
        folderId: childFolder.folderId,
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === second.documentId,
        ),
      ).toMatchObject({
        documentRevisionId: saved.revisionId,
        initialText: manuscript,
      });

      runtime.close();
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, {
        readOnly: true,
      });
      try {
        expect(
          database
            .prepare("SELECT retired_at AS retiredAt FROM document_folders WHERE id = ?")
            .get(rootFolder.folderId),
        ).toEqual({ retiredAt: expect.any(String) });
        expect(
          database
            .prepare("SELECT folder_id AS folderId FROM documents WHERE id = ?")
            .get(first.documentId),
        ).toEqual({ folderId: null });
      } finally {
        database.close();
      }

      runtime = await openLocalWorkspaceRuntime(options);
      const reopenedWork = runtime
        .getWorkspaceCatalog()
        .works.find((work) => work.workId === first.workId);
      expect(reopenedWork?.folders).toEqual(firstWork?.folders);
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === second.documentId,
        ),
      ).toMatchObject({
        documentRevisionId: saved.revisionId,
        initialText: manuscript,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("retires Works without deleting their owned manuscript data", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-retire-work-metadata-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = `보존할 원고 ${randomUUID()}`;
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: second.workId,
          documentId: second.documentId,
          baseRevisionId: second.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );

      const afterActiveRetirement = await runtime.retireWork({
        schemaVersion: 1,
        workId: second.workId,
      });
      expect(afterActiveRetirement).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: first.documentId,
        canCreateFirstWork: false,
      });
      expect(afterActiveRetirement.works.map((work) => work.workId)).toEqual([
        first.workId,
      ]);

      const third = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
      });
      const afterNonactiveRetirement = await runtime.retireWork({
        schemaVersion: 1,
        workId: third.workId,
      });
      expect(afterNonactiveRetirement).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: first.documentId,
      });

      const emptyCatalog = await runtime.retireWork({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(emptyCatalog).toEqual({
        schemaVersion: 1,
        works: [],
        activeWorkId: null,
        activeDocumentId: null,
        canCreateFirstWork: true,
      });
      await expect(
        runtime.retireWork({ schemaVersion: 1, workId: randomUUID() }),
      ).rejects.toThrow("Unknown Work");

      runtime.close();
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, {
        readOnly: true,
      });
      try {
        for (const workId of [first.workId, second.workId, third.workId]) {
          expect(
            database
              .prepare("SELECT retired_at AS retiredAt FROM works WHERE id = ?")
              .get(workId),
          ).toMatchObject({ retiredAt: expect.any(String) });
          expect(
            database
              .prepare("SELECT COUNT(*) AS count FROM documents WHERE work_id = ?")
              .get(workId),
          ).toEqual({ count: 1 });
          expect(
            database
              .prepare("SELECT COUNT(*) AS count FROM manuscripts WHERE work_id = ?")
              .get(workId),
          ).toEqual({ count: 1 });
          expect(
            database
              .prepare("SELECT COUNT(*) AS count FROM document_revisions WHERE work_id = ?")
              .get(workId),
          ).toMatchObject({ count: expect.any(Number) });
        }
        expect(
          database
            .prepare("SELECT COUNT(*) AS count FROM document_revisions WHERE work_id = ?")
            .get(second.workId),
        ).toEqual({ count: 2 });
      } finally {
        database.close();
      }

      runtime = await openLocalWorkspaceRuntime(options);
      expect(runtime.getWorkspaceCatalog()).toEqual(emptyCatalog);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("retires Documents while preserving an empty Work and its manuscript data", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-retire-document-metadata-"),
    );
    const options = createOptions(rootDirectoryPath);
    const workTitle = randomUUID();
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: workTitle,
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      const manuscript = `보존할 회차 원고 ${randomUUID()}`;
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: second.documentId,
          baseRevisionId: second.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const third = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: second.documentId,
      });
      await expect(
        runtime.retireDocument({
          schemaVersion: 1,
          workId: randomUUID(),
          documentId: second.documentId,
        }),
      ).rejects.toThrow("Work/document boundary violation");

      const afterActiveRetirement = await runtime.retireDocument({
        schemaVersion: 1,
        workId: first.workId,
        documentId: second.documentId,
      });
      expect(afterActiveRetirement).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: third.documentId,
      });
      const afterNonactiveRetirement = await runtime.retireDocument({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
      });
      expect(afterNonactiveRetirement).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: third.documentId,
      });

      const emptyWorkCatalog = await runtime.retireDocument({
        schemaVersion: 1,
        workId: first.workId,
        documentId: third.documentId,
      });
      expect(emptyWorkCatalog).toEqual({
        schemaVersion: 1,
        works: [{
          workId: first.workId,
          title: workTitle,
          updatedAt: expect.any(String),
          folders: [],
          documents: [],
        }],
        activeWorkId: first.workId,
        activeDocumentId: null,
        canCreateFirstWork: false,
      });

      runtime.close();
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, {
        readOnly: true,
      });
      try {
        expect(
          database
            .prepare("SELECT COUNT(*) AS count FROM documents WHERE work_id = ?")
            .get(first.workId),
        ).toEqual({ count: 3 });
        expect(
          database
            .prepare("SELECT COUNT(*) AS count FROM documents WHERE work_id = ? AND retired_at IS NOT NULL")
            .get(first.workId),
        ).toEqual({ count: 3 });
        expect(
          database
            .prepare("SELECT COUNT(*) AS count FROM manuscripts WHERE work_id = ?")
            .get(first.workId),
        ).toEqual({ count: 3 });
        expect(
          database
            .prepare("SELECT COUNT(*) AS count FROM document_revisions WHERE work_id = ?")
            .get(first.workId),
        ).toEqual({ count: 4 });
      } finally {
        database.close();
      }

      runtime = await openLocalWorkspaceRuntime(options);
      expect(runtime.getWorkspaceCatalog()).toEqual(emptyWorkCatalog);
      const recreated = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "",
      });
      expect(runtime.getWorkspaceCatalog()).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: recreated.documentId,
        canCreateFirstWork: false,
        works: [{
          workId: first.workId,
          documents: [{
            documentId: recreated.documentId,
            title: "제목없음",
          }],
        }],
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates additional Works and Documents and reopens the exact per-Work resume range", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-multi-work-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const continued = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: randomUUID(),
      });
      const manuscript = randomUUID();
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: continued.documentId,
          baseRevisionId: continued.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const selection = {
        anchor: manuscript.length,
        head: Math.max(1, manuscript.length - 5),
      } as const;
      const captured = await runtime.captureWorkspaceResume({
        schemaVersion: 1,
        workId: first.workId,
        documentId: continued.documentId,
        selection,
        workspaceMode: "writing",
      });
      expect(captured).toMatchObject({
        status: "resolved",
        workId: first.workId,
        documentId: continued.documentId,
        selection,
      });

      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      expect(runtime.getWorkspaceCatalog().works).toHaveLength(2);
      expect(
        runtime.getWorkspaceCatalog().works.find(
          (work) => work.workId === first.workId,
        )?.documents,
      ).toHaveLength(2);
      expect(second.workId).not.toBe(first.workId);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const activated = await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: null,
      });
      expect(activated).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: continued.documentId,
      });
      expect(runtime.getManuscriptResumeCheckpoint()).toMatchObject({
        status: "resolved",
        workId: first.workId,
        documentId: continued.documentId,
        selection,
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === continued.documentId,
        ),
      ).toMatchObject({ initialText: manuscript });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("keeps the active durable sequence when workspace navigation reloads the catalog", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-navigation-sequence-"),
    );
    const options = createOptions(rootDirectoryPath);
    const runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const firstText = randomUUID();
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: first.documentId,
          baseRevisionId: first.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: firstText.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: firstText,
          }],
        }),
      );
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await runtime.activateWorkspaceLocation({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
      });

      const appendedText = randomUUID();
      const receipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: first.documentId,
          baseRevisionId: first.revisionId,
          sequence: 1,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: firstText.length,
          afterTextLengthUtf16: firstText.length + appendedText.length,
          changes: [{
            fromUtf16: firstText.length,
            toUtf16: firstText.length,
            insertedText: appendedText,
          }],
        }),
      );

      expect(receipt).toMatchObject({
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 1,
      });
      const persistenceProfile =
        runtime.getManuscriptPersistenceProfile();
      expect(persistenceProfile).not.toBeNull();
      expect(persistenceProfile?.documentSequences).toContainEqual({
          documentId: first.documentId,
          nextSequence: 2,
        });
      expect(runtime.getWorkspaceCatalog()).toMatchObject({
        activeWorkId: first.workId,
        activeDocumentId: first.documentId,
      });
      expect(second.workId).not.toBe(first.workId);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("stores an exact selected range as an EventBlock and resolves it after reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-event-block-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "도입 문장과 정확히 선택할 사건 원문과 마무리 문장";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const exactQuote = "정확히 선택할 사건 원문";
      const from = manuscript.indexOf(exactQuote);
      const to = from + exactQuote.length;
      const createdEvent = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: to, head: from },
        exactQuote,
        title: "첫 사건",
        note: "선택 범위를 그대로 저장",
      });

      expect(createdEvent).toMatchObject({
        workId: created.workId,
        title: "첫 사건",
      });
      const listed = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(listed.eventBlocks).toContainEqual(createdEvent);
      expect(listed.eventSources).toHaveLength(1);
      expect(listed.eventSources[0]).toMatchObject({
        eventBlockId: createdEvent.eventBlockId,
        role: "primary",
        anchors: [{
          documentId: created.documentId,
          exactQuote,
          integrity: "resolved",
          range: { from, to },
        }],
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.eventBlocks).toHaveLength(1);
      expect(reopened.eventBlocks[0]).toMatchObject({
        eventBlockId: createdEvent.eventBlockId,
      });
      expect(reopened.eventSources[0]).toMatchObject({
        eventBlockId: createdEvent.eventBlockId,
        role: "primary",
        anchors: [{
          documentId: created.documentId,
          exactQuote,
          integrity: "resolved",
          range: { from, to },
        }],
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("migrates a version 1 EventBlock range into one primary EventSource", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-event-source-migration-"),
    );
    const options = createOptions(rootDirectoryPath);
    const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "마이그레이션 전 사건 근거를 정확히 보존한다.";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const exactQuote = "사건 근거를 정확히 보존";
      const from = manuscript.indexOf(exactQuote);
      const eventBlock = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: from, head: from + exactQuote.length },
        exactQuote,
        title: "기존 사건",
        note: "v1 fixture",
      });
      runtime.close();

      const legacy = new DatabaseSync(profiles.databasePath);
      try {
        legacy.exec("PRAGMA foreign_keys = OFF");
        legacy.exec(`
          BEGIN IMMEDIATE;

          CREATE TABLE event_blocks_v1 (
            id TEXT PRIMARY KEY,
            schema_version INTEGER NOT NULL,
            revision INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            retired_at TEXT,
            work_id TEXT NOT NULL,
            range_group_id TEXT NOT NULL,
            parent_event_id TEXT,
            title TEXT NOT NULL,
            note TEXT,
            stage_ref TEXT,
            order_key TEXT NOT NULL,
            collapsed INTEGER NOT NULL,
            relation_ids_json TEXT,
            UNIQUE (work_id, id),
            FOREIGN KEY (work_id, range_group_id)
              REFERENCES range_groups (work_id, id)
              ON DELETE RESTRICT,
            FOREIGN KEY (work_id, parent_event_id)
              REFERENCES event_blocks_v1 (work_id, id)
              ON DELETE RESTRICT
              DEFERRABLE INITIALLY DEFERRED
          ) STRICT;

          INSERT INTO event_blocks_v1 (
            id,
            schema_version,
            revision,
            created_at,
            updated_at,
            retired_at,
            work_id,
            range_group_id,
            parent_event_id,
            title,
            note,
            stage_ref,
            order_key,
            collapsed,
            relation_ids_json
          )
          SELECT
            e.id,
            e.schema_version,
            e.revision,
            e.created_at,
            e.updated_at,
            e.retired_at,
            e.work_id,
            es.range_group_id,
            e.parent_event_id,
            e.title,
            e.note,
            e.stage_ref,
            e.order_key,
            e.collapsed,
            e.relation_ids_json
          FROM event_blocks AS e
          JOIN event_sources AS es
            ON es.work_id = e.work_id
            AND es.event_block_id = e.id
            AND es.role = 'primary'
            AND es.retired_at IS NULL;

          CREATE TABLE activity_interval_event_blocks_v1 (
            work_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            activity_interval_id TEXT NOT NULL,
            event_block_id TEXT NOT NULL,
            PRIMARY KEY (activity_interval_id, event_block_id),
            FOREIGN KEY (work_id, session_id, activity_interval_id)
              REFERENCES activity_intervals (work_id, session_id, id)
              ON DELETE RESTRICT,
            FOREIGN KEY (work_id, event_block_id)
              REFERENCES event_blocks_v1 (work_id, id)
              ON DELETE RESTRICT
          ) STRICT;

          INSERT INTO activity_interval_event_blocks_v1
          SELECT * FROM activity_interval_event_blocks;

          DROP TABLE scene_event_overrides;
          DROP TABLE scene_rule_sets;
          DROP TABLE plot_placements;
          DROP TABLE plot_lanes;
          DROP TABLE plot_boards;
          DROP TABLE plot_event_links;
          DROP TABLE activity_interval_event_blocks;
          DROP TABLE event_sources;
          UPDATE event_blocks
          SET parent_event_id = NULL
          WHERE parent_event_id IS NOT NULL;
          DROP TABLE event_blocks;
          ALTER TABLE event_blocks_v1 RENAME TO event_blocks;
          ALTER TABLE activity_interval_event_blocks_v1
            RENAME TO activity_interval_event_blocks;

          UPDATE storage_ledger_identity
          SET target_schema_version = 1;
          PRAGMA user_version = 1;
          COMMIT;
        `);
      } finally {
        legacy.close();
      }

      runtime = await openLocalWorkspaceRuntime(options);
      const migrated = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(migrated.eventBlocks).toHaveLength(1);
      expect(migrated.eventBlocks[0]).toMatchObject({
        eventBlockId: eventBlock.eventBlockId,
        title: "기존 사건",
      });
      expect(migrated.eventSources).toHaveLength(1);
      expect(migrated.eventSources[0]).toMatchObject({
        eventBlockId: eventBlock.eventBlockId,
        role: "primary",
        anchors: [{
          documentId: created.documentId,
          exactQuote,
          integrity: "resolved",
          range: { from, to: from + exactQuote.length },
        }],
      });
      runtime.close();

      const audit = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(audit.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 5,
        });
        expect(
          audit.prepare(`
            SELECT target_schema_version AS "targetSchemaVersion"
            FROM storage_ledger_identity
          `).get(),
        ).toEqual({ targetSchemaVersion: 5 });
        expect(
          audit.prepare(`
            SELECT name
            FROM pragma_table_info('event_blocks')
            WHERE name = 'range_group_id'
          `).all(),
        ).toEqual([]);
        expect(
          audit.prepare(`
            SELECT migration_id AS "migrationId"
            FROM migration_receipts
            WHERE migration_id = 'local-workspace-event-source-v1-to-v2'
          `).get(),
        ).toEqual({
          migrationId: "local-workspace-event-source-v1-to-v2",
        });
        expect(
          audit.prepare(`
            SELECT migration_id AS "migrationId"
            FROM migration_receipts
            WHERE migration_id = 'local-workspace-plot-event-link-v2-to-v3'
          `).get(),
        ).toEqual({
          migrationId: "local-workspace-plot-event-link-v2-to-v3",
        });
        expect(
          audit.prepare(`
            SELECT migration_id AS "migrationId"
            FROM migration_receipts
            WHERE migration_id = 'local-workspace-plot-board-v3-to-v4'
          `).get(),
        ).toEqual({ migrationId: "local-workspace-plot-board-v3-to-v4" });
        expect(
          audit.prepare(`
            SELECT migration_id AS "migrationId"
            FROM migration_receipts
            WHERE migration_id = 'local-workspace-scene-projection-v4-to-v5'
          `).get(),
        ).toEqual({
          migrationId: "local-workspace-scene-projection-v4-to-v5",
        });
      } finally {
        audit.close();
      }
      runtime = await openLocalWorkspaceRuntime(options);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("migrates version 2 plot and event content into the PlotEventLink schema", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-event-link-migration-"),
    );
    const options = createOptions(rootDirectoryPath);
    const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const eventBlock = await runtime.createAnchorlessEvent({
        schemaVersion: 1,
        workId: created.workId,
        title: "이전 사건",
        note: "v2 사건 내용",
      });
      const plotBeat = await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "이전 플롯",
        stage: "",
        summary: "v2 플롯 내용",
        note: "",
      });
      runtime.close();

      const versionTwo = new DatabaseSync(profiles.databasePath);
      try {
        versionTwo.exec("PRAGMA foreign_keys = OFF");
        versionTwo.exec(`
          BEGIN IMMEDIATE;
          DROP TABLE scene_event_overrides;
          DROP TABLE scene_rule_sets;
          DROP TABLE plot_placements;
          DROP TABLE plot_lanes;
          DROP TABLE plot_boards;
          DROP TABLE plot_event_links;
          UPDATE storage_ledger_identity
          SET target_schema_version = 2;
          PRAGMA user_version = 2;
          COMMIT;
        `);
      } finally {
        versionTwo.close();
      }

      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      })).eventBlocks).toContainEqual(eventBlock);
      expect((await runtime.listPlotThreads({
        schemaVersion: 1,
        workId: created.workId,
      })).plots).toContainEqual(plotBeat);
      expect(await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      })).toMatchObject({
        workId: created.workId,
        mode: "sequence",
        lanes: [{
          kind: "default",
          placements: [{ plotBeatId: plotBeat.plotThreadId }],
        }],
      });
      expect(await runtime.listPlotEventLinks({
        schemaVersion: 1,
        workId: created.workId,
      })).toMatchObject({ links: [] });
      runtime.close();

      const audit = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(audit.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 5,
        });
        expect(audit.prepare(`
          SELECT target_schema_version AS "targetSchemaVersion"
          FROM storage_ledger_identity
        `).get()).toEqual({ targetSchemaVersion: 5 });
        expect(audit.prepare(`
          SELECT migration_id AS "migrationId"
          FROM migration_receipts
          WHERE migration_id = 'local-workspace-plot-event-link-v2-to-v3'
        `).get()).toEqual({
          migrationId: "local-workspace-plot-event-link-v2-to-v3",
        });
        expect(audit.prepare(`
          SELECT migration_id AS "migrationId"
          FROM migration_receipts
          WHERE migration_id = 'local-workspace-plot-board-v3-to-v4'
        `).get()).toEqual({
          migrationId: "local-workspace-plot-board-v3-to-v4",
        });
        expect(audit.prepare(`
          SELECT migration_id AS "migrationId"
          FROM migration_receipts
          WHERE migration_id = 'local-workspace-scene-projection-v4-to-v5'
        `).get()).toEqual({
          migrationId: "local-workspace-scene-projection-v4-to-v5",
        });
        expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        audit.close();
      }
      runtime = await openLocalWorkspaceRuntime(options);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("keeps an anchorless EventBlock while linking, replacing, and retiring its EventSource", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-anchorless-event-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "첫 연결 원문 뒤에 둘째 교체 원문이 이어진다.";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      const eventBlock = await runtime.createAnchorlessEvent({
        schemaVersion: 1,
        workId: created.workId,
        title: "예정 사건",
        note: "원고보다 먼저 작성",
      });
      let projection = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(projection.eventBlocks).toContainEqual(eventBlock);
      expect(projection.eventSources).toEqual([]);

      const firstQuote = "첫 연결 원문";
      const firstFrom = manuscript.indexOf(firstQuote);
      const linked = await runtime.linkEventSource({
        schemaVersion: 1,
        workId: created.workId,
        eventBlockId: eventBlock.eventBlockId,
        role: "primary",
        documentId: created.documentId,
        selection: {
          anchor: firstFrom + firstQuote.length,
          head: firstFrom,
        },
        exactQuote: firstQuote,
      });
      expect(linked).toMatchObject({
        eventBlockId: eventBlock.eventBlockId,
        role: "primary",
        anchors: [{
          exactQuote: firstQuote,
          range: { from: firstFrom, to: firstFrom + firstQuote.length },
        }],
      });

      const secondQuote = "둘째 교체 원문";
      const secondFrom = manuscript.indexOf(secondQuote);
      const replaced = await runtime.replaceEventSource({
        schemaVersion: 1,
        workId: created.workId,
        eventSourceId: linked.eventSourceId,
        expectedRevision: linked.revision,
        documentId: created.documentId,
        selection: {
          anchor: secondFrom,
          head: secondFrom + secondQuote.length,
        },
        exactQuote: secondQuote,
      });
      expect(replaced.eventSourceId).not.toBe(linked.eventSourceId);
      expect(replaced).toMatchObject({
        eventBlockId: eventBlock.eventBlockId,
        role: "primary",
        anchors: [{
          exactQuote: secondQuote,
          range: { from: secondFrom, to: secondFrom + secondQuote.length },
        }],
      });
      projection = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(projection.eventSources).toHaveLength(1);
      expect(projection.eventSources[0]?.eventSourceId).toBe(
        replaced.eventSourceId,
      );

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      projection = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(projection.eventBlocks).toContainEqual(eventBlock);
      expect(projection.eventSources[0]).toMatchObject({
        eventSourceId: replaced.eventSourceId,
        anchors: [{ exactQuote: secondQuote }],
      });

      const retired = await runtime.retireEventSource({
        schemaVersion: 1,
        workId: created.workId,
        eventSourceId: replaced.eventSourceId,
        expectedRevision: replaced.revision,
      });
      expect(retired).toMatchObject({
        eventSourceId: replaced.eventSourceId,
        revision: replaced.revision + 1,
      });
      expect(retired.retiredAt).not.toBeNull();
      projection = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(projection.eventBlocks).toHaveLength(1);
      expect(projection.eventSources).toEqual([]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      projection = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(projection.eventBlocks).toHaveLength(1);
      expect(projection.eventSources).toEqual([]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("copies exact selected text into a Work-owned fragment and soft-retires it", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-fragment-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "앞 문장\n  그대로 보관할 원문\n뒤 문장";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: first.documentId,
          baseRevisionId: first.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
        }),
      );
      const exactText = "  그대로 보관할 원문\n";
      const from = manuscript.indexOf(exactText);
      const to = from + exactText.length;
      const captured = await runtime.captureFragment({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        selection: { anchor: to, head: from },
        exactText,
        kindId: options.fragmentProfile.defaultKindId,
        title: "",
      });

      expect(captured).toMatchObject({
        revision: 1,
        workId: first.workId,
        sourceDocumentId: first.documentId,
        kindId: options.fragmentProfile.defaultKindId,
        title: "",
        pinned: false,
        useCount: 0,
        exactText,
        integrity: "resolved",
        range: { from, to },
        retiredAt: null,
      });
      expect((await runtime.listFragments({
        schemaVersion: 1,
        workId: first.workId,
      })).fragments).toEqual([captured]);
      await expect(runtime.listFragments({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({ fragments: [] });
      await expect(runtime.updateFragment({
        schemaVersion: 1,
        workId: second.workId,
        fragmentId: captured.fragmentId,
        expectedRevision: 1,
        changes: { pinned: true },
      })).rejects.toThrow("Work/fragment boundary violation");

      await expect(runtime.recordFragmentUse({
        schemaVersion: 1,
        workId: second.workId,
        fragmentId: captured.fragmentId,
        expectedRevision: 1,
      })).rejects.toThrow("Work/fragment boundary violation");
      const used = await runtime.recordFragmentUse({
        schemaVersion: 1,
        workId: first.workId,
        fragmentId: captured.fragmentId,
        expectedRevision: 1,
      });
      expect(used).toMatchObject({
        revision: 2,
        useCount: 1,
        exactText,
      });
      await expect(runtime.recordFragmentUse({
        schemaVersion: 1,
        workId: first.workId,
        fragmentId: captured.fragmentId,
        expectedRevision: 1,
      })).rejects.toThrow("Fragment revision conflict");

      const updated = await runtime.updateFragment({
        schemaVersion: 1,
        workId: first.workId,
        fragmentId: captured.fragmentId,
        expectedRevision: 2,
        changes: { title: "보관 문장", pinned: true },
      });
      expect(updated).toMatchObject({
        revision: 3,
        title: "보관 문장",
        pinned: true,
        useCount: 1,
        exactText,
      });
      const retired = await runtime.retireFragment({
        schemaVersion: 1,
        workId: first.workId,
        fragmentId: captured.fragmentId,
        expectedRevision: 3,
      });
      expect(retired).toMatchObject({ revision: 4, useCount: 1, exactText });
      expect(retired.retiredAt).not.toBeNull();
      expect((await runtime.listFragments({
        schemaVersion: 1,
        workId: first.workId,
      })).fragments).toEqual([]);
      expect(runtime.getManuscriptDocumentProfile().documents
        .find((document) => document.documentId === first.documentId)?.initialText)
        .toBe(manuscript);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listFragments({
        schemaVersion: 1,
        workId: first.workId,
      })).fragments).toEqual([]);
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(database.prepare(
          "SELECT retired_at AS retiredAt FROM fragments WHERE id = ?",
        ).get(captured.fragmentId)).toMatchObject({
          retiredAt: retired.retiredAt,
        });
      } finally {
        database.close();
      }
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned foreshadow lines and soft-retires them without stored resolution state", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-foreshadow-line-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const created = await runtime.createForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        title: "되돌아올 약속",
        note: "첫 회차에 심는다.",
      });

      expect(created).toMatchObject({
        revision: 1,
        workId: first.workId,
        title: "되돌아올 약속",
        note: "첫 회차에 심는다.",
        retiredAt: null,
      });
      expect((await runtime.listForeshadowLines({
        schemaVersion: 1,
        workId: first.workId,
      })).lines).toEqual([created]);
      await expect(runtime.listForeshadowLines({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({ lines: [] });
      await expect(runtime.updateForeshadowLine({
        schemaVersion: 1,
        workId: second.workId,
        lineId: created.lineId,
        expectedRevision: 1,
        changes: { note: "다른 작품에서 바꾸기" },
      })).rejects.toThrow("Work/foreshadow line boundary violation");

      const updated = await runtime.updateForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        lineId: created.lineId,
        expectedRevision: 1,
        changes: {
          title: "마지막 문에서 돌아올 약속",
          note: "두 번째 단서까지 연결한다.",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        title: "마지막 문에서 돌아올 약속",
        note: "두 번째 단서까지 연결한다.",
      });
      await expect(runtime.updateForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        lineId: created.lineId,
        expectedRevision: 1,
        changes: { note: "stale" },
      })).rejects.toThrow("Foreshadow line revision conflict");
      await expect(runtime.retireForeshadowLine({
        schemaVersion: 1,
        workId: second.workId,
        lineId: created.lineId,
        expectedRevision: 2,
      })).rejects.toThrow("Work/foreshadow line boundary violation");

      const retired = await runtime.retireForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        lineId: created.lineId,
        expectedRevision: 2,
      });
      expect(retired).toMatchObject({ revision: 3 });
      expect(retired.retiredAt).not.toBeNull();
      expect((await runtime.listForeshadowLines({
        schemaVersion: 1,
        workId: first.workId,
      })).lines).toEqual([]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listForeshadowLines({
        schemaVersion: 1,
        workId: first.workId,
      })).lines).toEqual([]);
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(database.prepare(
          "SELECT retired_at AS retiredAt FROM foreshadow_lines WHERE id = ?",
        ).get(created.lineId)).toMatchObject({ retiredAt: retired.retiredAt });
        const columns = database.prepare(
          "PRAGMA table_info(foreshadow_lines)",
        ).all().map((column) => String(column.name));
        expect(columns).not.toContain("resolution");
        expect(columns).not.toContain("status");
        expect(columns).not.toContain("payoff_state");
      } finally {
        database.close();
      }
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned characters and soft-retires them across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-character-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const created = await runtime.createCharacter({
        schemaVersion: 1,
        workId: first.workId,
        name: "윤서",
        role: "",
        summary: "사건을 관찰한다.",
        note: "말투 확인",
      });

      expect(created).toMatchObject({
        revision: 1,
        workId: first.workId,
        name: "윤서",
        role: "",
        summary: "사건을 관찰한다.",
        note: "말투 확인",
        retiredAt: null,
      });
      expect((await runtime.listCharacters({
        schemaVersion: 1,
        workId: first.workId,
      })).characters).toEqual([created]);
      await expect(runtime.listCharacters({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({ characters: [] });
      await expect(runtime.updateCharacter({
        schemaVersion: 1,
        workId: second.workId,
        characterId: created.characterId,
        expectedRevision: 1,
        changes: { role: "다른 작품에서 바꾸기" },
      })).rejects.toThrow("Work/character boundary violation");

      const updated = await runtime.updateCharacter({
        schemaVersion: 1,
        workId: first.workId,
        characterId: created.characterId,
        expectedRevision: 1,
        changes: {
          name: "윤서린",
          role: "기록자",
          summary: "사건의 증언자다.",
          note: "2화 말투 확인",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        name: "윤서린",
        role: "기록자",
        summary: "사건의 증언자다.",
        note: "2화 말투 확인",
      });
      await expect(runtime.updateCharacter({
        schemaVersion: 1,
        workId: first.workId,
        characterId: created.characterId,
        expectedRevision: 1,
        changes: { note: "stale" },
      })).rejects.toThrow("Character revision conflict");
      await expect(runtime.retireCharacter({
        schemaVersion: 1,
        workId: second.workId,
        characterId: created.characterId,
        expectedRevision: 2,
      })).rejects.toThrow("Work/character boundary violation");

      const retired = await runtime.retireCharacter({
        schemaVersion: 1,
        workId: first.workId,
        characterId: created.characterId,
        expectedRevision: 2,
      });
      expect(retired).toMatchObject({ revision: 3 });
      expect(retired.retiredAt).not.toBeNull();
      expect((await runtime.listCharacters({
        schemaVersion: 1,
        workId: first.workId,
      })).characters).toEqual([]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listCharacters({
        schemaVersion: 1,
        workId: first.workId,
      })).characters).toEqual([]);
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(database.prepare(
          "SELECT name, role, summary, note, retired_at AS retiredAt FROM characters WHERE id = ?",
        ).get(created.characterId)).toMatchObject({
          name: "윤서린",
          role: "기록자",
          summary: "사건의 증언자다.",
          note: "2화 말투 확인",
          retiredAt: retired.retiredAt,
        });
      } finally {
        database.close();
      }
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned lore with exact evidence and immutable revision history", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-lore-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "북쪽 탑의 종이 세 번 울렸다. 문 없는 방은 출구를 기억한다.";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: first.documentId,
          baseRevisionId: first.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
        }),
      );
      const firstEvidence = "북쪽 탑의 종이 세 번 울렸다.";
      const firstFrom = manuscript.indexOf(firstEvidence);
      const created = await runtime.createLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        title: "북쪽 탑",
        content: "종이 세 번 울린다.",
        category: "장소 규칙",
        aliases: ["북탑", "종탑"],
        enabled: true,
        evidence: {
          documentId: first.documentId,
          selection: {
            anchor: firstFrom + firstEvidence.length,
            head: firstFrom,
          },
          exactText: firstEvidence,
        },
      });

      expect(created).toMatchObject({
        revision: 1,
        workId: first.workId,
        title: "북쪽 탑",
        content: "종이 세 번 울린다.",
        category: "장소 규칙",
        aliases: ["북탑", "종탑"],
        enabled: true,
        evidences: [{
          sourceDocumentId: first.documentId,
          exactText: firstEvidence,
          integrity: "resolved",
          range: { from: firstFrom, to: firstFrom + firstEvidence.length },
        }],
        history: [{ changeKind: "created", entryRevision: 1 }],
        retiredAt: null,
      });
      await expect(runtime.createLoreEntry({
        schemaVersion: 1,
        workId: second.workId,
        title: "잘못된 근거",
        content: "다른 작품 원고를 쓰지 않는다.",
        category: "",
        aliases: [],
        enabled: true,
        evidence: {
          documentId: first.documentId,
          selection: { anchor: 0, head: firstEvidence.length },
          exactText: firstEvidence,
        },
      })).rejects.toThrow("Work/document boundary violation");

      const updated = await runtime.updateLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: created.loreEntryId,
        expectedRevision: 1,
        changes: {
          content: "해 질 무렵 종이 세 번 울린다.",
          category: "세계 규칙",
          aliases: ["북탑"],
          enabled: false,
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        content: "해 질 무렵 종이 세 번 울린다.",
        category: "세계 규칙",
        aliases: ["북탑"],
        enabled: false,
        history: [
          { changeKind: "updated", entryRevision: 2 },
          { changeKind: "created", entryRevision: 1 },
        ],
      });
      await expect(runtime.updateLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: created.loreEntryId,
        expectedRevision: 1,
        changes: { content: "stale" },
      })).rejects.toThrow("Lore entry revision conflict");

      const secondEvidence = "문 없는 방은 출구를 기억한다.";
      const secondFrom = manuscript.indexOf(secondEvidence);
      const withEvidence = await runtime.addLoreEntryEvidence({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: created.loreEntryId,
        expectedRevision: 2,
        documentId: first.documentId,
        selection: {
          anchor: secondFrom,
          head: secondFrom + secondEvidence.length,
        },
        exactText: secondEvidence,
      });
      expect(withEvidence).toMatchObject({
        revision: 3,
        evidences: [
          { exactText: firstEvidence, integrity: "resolved" },
          { exactText: secondEvidence, integrity: "resolved" },
        ],
        history: [
          { changeKind: "evidence-added", entryRevision: 3 },
          { changeKind: "updated", entryRevision: 2 },
          { changeKind: "created", entryRevision: 1 },
        ],
      });
      expect(withEvidence.history[0]?.evidenceAnchorIds).toHaveLength(2);

      const retiredCandidate = await runtime.createLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        title: "임시 별빛",
        content: "목록에서 치운다.",
        category: "",
        aliases: [],
        enabled: true,
        evidence: null,
      });
      const retired = await runtime.retireLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: retiredCandidate.loreEntryId,
        expectedRevision: 1,
      });
      expect(retired).toMatchObject({
        revision: 2,
        history: [
          { changeKind: "retired", entryRevision: 2 },
          { changeKind: "created", entryRevision: 1 },
        ],
      });
      expect(retired.retiredAt).not.toBeNull();
      expect((await runtime.listLoreEntries({
        schemaVersion: 1,
        workId: first.workId,
      })).entries).toEqual([withEvidence]);
      await expect(runtime.listLoreEntries({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({ entries: [] });

      runtime.close();
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath);
      try {
        expect(() => database.prepare(
          "UPDATE lore_entry_history SET title = ? WHERE lore_entry_id = ?",
        ).run("변조", created.loreEntryId)).toThrow("lore_entry_history is immutable");
      } finally {
        database.close();
      }
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listLoreEntries({
        schemaVersion: 1,
        workId: first.workId,
      })).entries).toEqual([withEvidence]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("links lore and foreshadow records without copying either canonical source", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-lore-foreshadow-links-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const firstLore = await runtime.createLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        title: "북쪽 탑",
        content: "종이 세 번 울린다.",
        category: "장소",
        aliases: ["북탑"],
        enabled: true,
        evidence: null,
      });
      const secondLore = await runtime.createLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        title: "닫힌 문",
        content: "열쇠는 하나다.",
        category: "규칙",
        aliases: [],
        enabled: true,
        evidence: null,
      });
      const firstLine = await runtime.createForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        title: "세 번의 종소리",
        note: "마지막 회차에서 회수",
      });
      const secondLine = await runtime.createForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        title: "하나뿐인 열쇠",
        note: "중반부 회수",
      });
      const outsideLine = await runtime.createForeshadowLine({
        schemaVersion: 1,
        workId: second.workId,
        title: "다른 작품 복선",
        note: "연결 금지",
      });

      const linked = await runtime.linkLoreForeshadow({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: firstLore.loreEntryId,
        lineId: firstLine.lineId,
      });
      expect(linked).toMatchObject({
        revision: 1,
        workId: first.workId,
        loreEntryId: firstLore.loreEntryId,
        lineId: firstLine.lineId,
        unlinkedAt: null,
        unlinkReason: null,
      });
      expect(Object.keys(linked).sort()).toEqual([
        "lineId",
        "linkId",
        "linkedAt",
        "loreEntryId",
        "revision",
        "schemaVersion",
        "unlinkReason",
        "unlinkedAt",
        "workId",
      ]);
      await expect(runtime.linkLoreForeshadow({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: firstLore.loreEntryId,
        lineId: outsideLine.lineId,
      })).rejects.toThrow("Work/foreshadow line boundary violation");
      await expect(runtime.linkLoreForeshadow({
        schemaVersion: 1,
        workId: second.workId,
        loreEntryId: firstLore.loreEntryId,
        lineId: outsideLine.lineId,
      })).rejects.toThrow("Work/lore entry boundary violation");

      const duplicate = await runtime.linkLoreForeshadow({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: firstLore.loreEntryId,
        lineId: firstLine.lineId,
      });
      expect(duplicate).toEqual(linked);
      const unlinked = await runtime.unlinkLoreForeshadow({
        schemaVersion: 1,
        workId: first.workId,
        linkId: linked.linkId,
        expectedRevision: linked.revision,
      });
      expect(unlinked).toMatchObject({ revision: 2, unlinkReason: "user" });
      expect(unlinked.unlinkedAt).not.toBeNull();
      const relinked = await runtime.linkLoreForeshadow({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: firstLore.loreEntryId,
        lineId: firstLine.lineId,
      });
      expect(relinked.linkId).not.toBe(linked.linkId);

      const loreRetirementLink = await runtime.linkLoreForeshadow({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: secondLore.loreEntryId,
        lineId: secondLine.lineId,
      });
      await runtime.retireForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        lineId: firstLine.lineId,
        expectedRevision: firstLine.revision,
      });
      const afterLineRetirement = await runtime.listLoreForeshadowLinks({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(afterLineRetirement.links.find(
        (entry) => entry.linkId === relinked.linkId,
      )).toMatchObject({ revision: 2, unlinkReason: "foreshadow-retired" });
      expect((await runtime.listLoreEntries({
        schemaVersion: 1,
        workId: first.workId,
      })).entries.find(
        (entry) => entry.loreEntryId === firstLore.loreEntryId,
      )).toMatchObject({ title: firstLore.title, retiredAt: null });

      await runtime.retireLoreEntry({
        schemaVersion: 1,
        workId: first.workId,
        loreEntryId: secondLore.loreEntryId,
        expectedRevision: secondLore.revision,
      });
      const afterLoreRetirement = await runtime.listLoreForeshadowLinks({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(afterLoreRetirement.links.find(
        (entry) => entry.linkId === loreRetirementLink.linkId,
      )).toMatchObject({ revision: 2, unlinkReason: "lore-retired" });
      expect((await runtime.listForeshadowLines({
        schemaVersion: 1,
        workId: first.workId,
      })).lines.find(
        (line) => line.lineId === secondLine.lineId,
      )).toMatchObject({ title: secondLine.title, retiredAt: null });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(await runtime.listLoreForeshadowLinks({
        schemaVersion: 1,
        workId: first.workId,
      })).toEqual(afterLoreRetirement);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("keeps exact Lore Candidates separate until explicit approval or rejection", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-lore-candidates-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "북쪽 탑의 종이 세 번 울렸다. 문 없는 방은 출구를 기억한다.";
      const saved = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      if (!("revisionId" in saved)) {
        throw new Error("Lore Candidate fixture must create a durable revision");
      }
      const firstExactText = "북쪽 탑의 종이 세 번 울렸다.";
      const firstFrom = manuscript.indexOf(firstExactText);
      const createCandidate = await runtime.createLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        selection: {
          anchor: firstFrom + firstExactText.length,
          head: firstFrom,
        },
        exactText: firstExactText,
        source: "user",
        certainty: "explicit",
        proposal: {
          kind: "create",
          title: "북쪽 탑",
          content: "종이 세 번 울린다.",
          category: "장소",
          aliases: ["북탑"],
          enabled: true,
        },
        reason: "사용자가 직접 선택함",
      });
      expect(createCandidate).toMatchObject({
        revision: 1,
        workId: first.workId,
        status: "pending",
        approvalBlockReason: null,
        evidence: {
          sourceDocumentId: first.documentId,
          sourceDocumentRevisionId: saved.revisionId,
          exactText: firstExactText,
          integrity: "resolved",
          range: {
            from: firstFrom,
            to: firstFrom + firstExactText.length,
          },
        },
      });
      expect((await runtime.listLoreEntries({
        schemaVersion: 1,
        workId: first.workId,
      })).entries).toEqual([]);
      await expect(runtime.createLoreCandidate({
        schemaVersion: 1,
        workId: second.workId,
        documentId: first.documentId,
        selection: { anchor: firstFrom, head: firstFrom + firstExactText.length },
        exactText: firstExactText,
        source: "user",
        certainty: "explicit",
        proposal: createCandidate.proposal,
        reason: "다른 작품",
      })).rejects.toThrow("Work/document boundary violation");

      const inferredCandidate = await runtime.createLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        selection: { anchor: firstFrom, head: firstFrom + firstExactText.length },
        exactText: firstExactText,
        source: "assistant",
        certainty: "inferred",
        proposal: {
          kind: "create",
          title: "추론 후보",
          content: "승인하지 않는다.",
          category: "",
          aliases: [],
          enabled: true,
        },
        reason: "추론",
      });
      expect(inferredCandidate.approvalBlockReason).toBe("inferred");
      await expect(runtime.approveLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        candidateId: inferredCandidate.candidateId,
        expectedRevision: inferredCandidate.revision,
      })).rejects.toThrow("Lore Candidate approval blocked: inferred");
      const rejected = await runtime.rejectLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        candidateId: inferredCandidate.candidateId,
        expectedRevision: inferredCandidate.revision,
      });
      expect(rejected).toMatchObject({
        revision: 2,
        status: "rejected",
        approvalBlockReason: "already-reviewed",
      });

      const approvedCreate = await runtime.approveLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        candidateId: createCandidate.candidateId,
        expectedRevision: createCandidate.revision,
      });
      expect(approvedCreate.candidate).toMatchObject({
        revision: 2,
        status: "approved",
        approvedLoreEntryId: approvedCreate.loreEntry.loreEntryId,
      });
      expect(approvedCreate.loreEntry).toMatchObject({
        revision: 1,
        title: "북쪽 탑",
        content: "종이 세 번 울린다.",
        evidences: [{
          anchorId: createCandidate.evidence.anchorId,
          exactText: firstExactText,
        }],
      });

      const secondExactText = "문 없는 방은 출구를 기억한다.";
      const secondFrom = manuscript.indexOf(secondExactText);
      const updateCandidate = await runtime.createLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        selection: { anchor: secondFrom, head: secondFrom + secondExactText.length },
        exactText: secondExactText,
        source: "user",
        certainty: "explicit",
        proposal: {
          kind: "update",
          loreEntryId: approvedCreate.loreEntry.loreEntryId,
          expectedLoreEntryRevision: approvedCreate.loreEntry.revision,
          changes: { content: "종소리와 문 없는 방은 연결되어 있다." },
        },
        reason: "확정 내용 갱신",
      });
      const approvedUpdate = await runtime.approveLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        candidateId: updateCandidate.candidateId,
        expectedRevision: updateCandidate.revision,
      });
      expect(approvedUpdate.loreEntry).toMatchObject({
        revision: 2,
        content: "종소리와 문 없는 방은 연결되어 있다.",
      });
      expect(approvedUpdate.loreEntry.evidences).toHaveLength(2);

      const staleCandidate = await runtime.createLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        selection: { anchor: secondFrom, head: secondFrom + secondExactText.length },
        exactText: secondExactText,
        source: "user",
        certainty: "explicit",
        proposal: {
          kind: "create",
          title: "오래된 근거 후보",
          content: "승인 전에 원고가 바뀐다.",
          category: "",
          aliases: [],
          enabled: true,
        },
        reason: "stale 검증",
      });
      const changedText = `${manuscript}!`;
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 1,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: manuscript.length,
        afterTextLengthUtf16: changedText.length,
        changes: [{
          fromUtf16: manuscript.length,
          toUtf16: manuscript.length,
          insertedText: "!",
        }],
      }));
      const listed = await runtime.listLoreCandidates({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(listed.candidates.find(
        (candidate) => candidate.candidateId === staleCandidate.candidateId,
      )).toMatchObject({
        status: "pending",
        approvalBlockReason: "evidence-stale",
      });
      await expect(runtime.approveLoreCandidate({
        schemaVersion: 1,
        workId: first.workId,
        candidateId: staleCandidate.candidateId,
        expectedRevision: staleCandidate.revision,
      })).rejects.toThrow("Lore Candidate approval blocked: evidence-stale");

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listLoreCandidates({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(reopened.candidates).toHaveLength(4);
      expect(reopened.candidates.map((candidate) => candidate.status).sort())
        .toEqual(["approved", "approved", "pending", "rejected"]);
      expect((await runtime.listLoreEntries({
        schemaVersion: 1,
        workId: first.workId,
      })).entries).toEqual([approvedUpdate.loreEntry]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("keeps publishing assistant records as Candidates until approval seals current revisions", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-assistant-runtime-"),
    );
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const connectorCalls: Array<Parameters<
      NonNullable<LocalWorkspaceRuntimeOptions["executePublishingAssistantIntent"]>
    >[0]> = [];
    const options = {
      ...createOptions(rootDirectoryPath),
      executePublishingAssistantIntent: async (input: Parameters<
        NonNullable<LocalWorkspaceRuntimeOptions["executePublishingAssistantIntent"]>
      >[0]) => {
        connectorCalls.push(input);
        const isQuery = input.statement === "회신이 없는 투고를 보여줘";
        return {
          receipt: {
            schemaVersion: 1 as const,
            receiptId: entityId<"ConnectorReceipt">(randomUUID()),
            requestId: input.requestId,
            connectionId: input.connectionId,
            connectorKind: "test-structured-json",
            operation: "publishing-intent" as const,
            requestFingerprint: `sha256:${randomUUID()}`,
            startedAt: "2026-08-10T07:00:00.000Z",
            completedAt: "2026-08-10T07:00:01.000Z",
            resultState: "succeeded" as const,
          },
          payload: isQuery
            ? {
                kind: "query-open",
                workLabel: null,
                partnerLabels: [],
                submittedOn: null,
              }
            : {
                kind: "record-submissions",
                workLabel: "조수 투고 작품",
                partnerLabels: ["첫 투고처", "둘째 투고처"],
                submittedOn: "2026-08-09",
              },
        };
      },
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "조수 투고 작품",
        firstDocumentTitle: "1화",
      });
      const manuscript = "외부 투고 조수에게 전송되면 안 되는 원고 본문";
      const saved = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: work.workId,
        documentId: work.documentId,
        baseRevisionId: work.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      if (!("revisionId" in saved)) {
        throw new Error("Expected a revision save receipt");
      }
      const firstPartner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "첫 투고처",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const secondPartner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "둘째 투고처",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });

      const interpreted = await runtime.runPublishingAssistant({
        schemaVersion: 1,
        requestId: randomUUID(),
        connectionId,
        statement: "어제 조수 투고 작품을 두 투고처에 보냈어",
      });
      expect(interpreted).toMatchObject({
        status: "record-candidate",
        candidate: {
          workId: work.workId,
          records: [
            { partnerId: firstPartner.partnerId, submittedOn: "2026-08-09" },
            { partnerId: secondPartner.partnerId, submittedOn: "2026-08-09" },
          ],
        },
      });
      expect(connectorCalls).toHaveLength(1);
      expect(connectorCalls[0]).toMatchObject({
        connectionId,
        statement: "어제 조수 투고 작품을 두 투고처에 보냈어",
        registry: {
          works: [{ workId: work.workId, title: "조수 투고 작품" }],
          partners: expect.arrayContaining([
            { partnerId: firstPartner.partnerId, name: "첫 투고처" },
            { partnerId: secondPartner.partnerId, name: "둘째 투고처" },
          ]),
          submissions: [],
        },
      });
      const transmitted = JSON.stringify(connectorCalls[0]);
      expect(transmitted).not.toContain(manuscript);
      expect(transmitted).not.toContain("manuscript");
      expect(transmitted).not.toContain("credential");
      expect((await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: work.workId,
      })).submissions).toEqual([]);
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual([]);
      if (interpreted.status !== "record-candidate") {
        throw new Error("Expected a publishing record Candidate");
      }

      const approved = await runtime.approvePublishingAssistantCandidate({
        schemaVersion: 1,
        candidateId: interpreted.candidate.candidateId,
      });
      expect(approved.source).toMatchObject({
        kind: "user-statement",
        label: "어제 조수 투고 작품을 두 투고처에 보냈어",
        importedFields: {
          statement: "어제 조수 투고 작품을 두 투고처에 보냈어",
          connectionId,
          connectorReceiptId: interpreted.candidate.connectorReceiptId,
        },
      });
      expect(approved.submissions).toHaveLength(2);
      expect(approved.submissions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          workId: work.workId,
          partnerId: firstPartner.partnerId,
          submittedOn: "2026-08-09",
          sourceIds: [approved.source.sourceId],
          package: expect.objectContaining({
            documentRevisions: [{
              documentId: work.documentId,
              documentRevisionId: saved.revisionId,
            }],
          }),
        }),
        expect.objectContaining({
          workId: work.workId,
          partnerId: secondPartner.partnerId,
          submittedOn: "2026-08-09",
          sourceIds: [approved.source.sourceId],
        }),
      ]));

      const beforeQuerySources = await runtime.listPublishingSources({ schemaVersion: 1 });
      const queried = await runtime.runPublishingAssistant({
        schemaVersion: 1,
        requestId: randomUUID(),
        connectionId,
        statement: "회신이 없는 투고를 보여줘",
      });
      expect(queried).toMatchObject({
        status: "query",
        query: "open",
        submissionIds: expect.arrayContaining(
          approved.submissions.map((submission) => submission.submissionId),
        ),
      });
      expect(await runtime.listPublishingSources({ schemaVersion: 1 }))
        .toEqual(beforeQuerySources);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopenedSubmissions = (await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: work.workId,
      })).submissions;
      expect(reopenedSubmissions).toHaveLength(approved.submissions.length);
      expect(reopenedSubmissions).toEqual(
        expect.arrayContaining([...approved.submissions]),
      );
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual([approved.source]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists the shared publishing partner ledger and explicit edits across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-partner-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const parent = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "이메일",
        websiteUrl: "https://publisher.example",
        email: "contact@publisher.example",
        genres: ["장르소설"],
        requiredLength: "원고 3화",
        priority: "검토 중",
        note: "공식 안내 확인",
      });
      const imprint = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "별빛문고",
        parentPartnerId: parent.partnerId,
        submissionMethod: "온라인 폼",
        websiteUrl: "https://publisher.example/submission",
        email: "story@publisher.example",
        genres: ["판타지", "로맨스"],
        requiredLength: "시놉시스와 원고 3화",
        priority: "이번 달",
        note: "마감일 확인",
      });

      const updated = await runtime.updatePublishingPartner({
        schemaVersion: 1,
        partnerId: imprint.partnerId,
        expectedRevision: imprint.revision,
        changes: {
          email: "novel@publisher.example",
          genres: ["판타지"],
          note: "담당 메일 갱신",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        name: "별빛문고",
        parentPartnerId: parent.partnerId,
        submissionMethod: "온라인 폼",
        email: "novel@publisher.example",
        genres: ["판타지"],
        note: "담당 메일 갱신",
        sourceIds: [],
      });
      expect((await runtime.listPublishingPartners({ schemaVersion: 1 })).partners)
        .toEqual([updated, parent]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingPartners({ schemaVersion: 1 })).partners)
        .toEqual([updated, parent]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("seals exact current document revisions in a SubmissionPackage while submission history remains editable", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-submission-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "별빛 아래",
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: work.workId,
        title: "2화",
      });
      const save = async (input: {
        readonly documentId: typeof work.documentId;
        readonly baseRevisionId: typeof work.revisionId;
        readonly text: string;
      }) => {
        const receipt = await runtime.saveChangeBatch(parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: work.workId,
          documentId: input.documentId,
          baseRevisionId: input.baseRevisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: input.text.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: input.text,
          }],
        }));
        if (!("revisionId" in receipt)) {
          throw new Error("Publishing submission setup must persist a revision");
        }
        return receipt.revisionId;
      };
      const firstRevisionId = await save({
        documentId: work.documentId,
        baseRevisionId: work.revisionId,
        text: "첫 원고",
      });
      const secondRevisionId = await save({
        documentId: second.documentId,
        baseRevisionId: second.revisionId,
        text: "둘째 원고",
      });
      const partner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "온라인 폼",
        websiteUrl: "https://publisher.example/submission",
        email: "story@publisher.example",
        genres: ["판타지"],
        requiredLength: "원고 2화",
        priority: "이번 달",
        note: "접수 안내 확인",
      });
      const created = await runtime.createPublishingSubmission({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        title: "봄 투고",
        status: "접수",
        submittedOn: "2026-08-10",
        respondedOn: null,
        result: "",
        note: "접수 번호 보관",
        cardNote: "장르 편집부",
      });
      expect(created).toMatchObject({
        revision: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        title: "봄 투고",
        status: "접수",
        package: {
          workId: work.workId,
          partnerId: partner.partnerId,
          workTitleSnapshot: "별빛 아래",
          partnerNameSnapshot: "은하출판",
          documentRevisions: [
            { documentId: work.documentId, documentRevisionId: firstRevisionId },
            { documentId: second.documentId, documentRevisionId: secondRevisionId },
          ].sort((left, right) => left.documentId.localeCompare(right.documentId)),
        },
      });
      const sealedPackage = created.package;

      const updated = await runtime.updatePublishingSubmission({
        schemaVersion: 1,
        submissionId: created.submissionId,
        expectedRevision: created.revision,
        changes: {
          status: "회신 완료",
          respondedOn: "2026-08-18",
          result: "수정 요청",
          note: "회신 원문 별도 보관",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        status: "회신 완료",
        respondedOn: "2026-08-18",
        result: "수정 요청",
        note: "회신 원문 별도 보관",
      });
      expect(updated.package).toEqual(sealedPackage);

      const laterReceipt = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: work.workId,
        documentId: work.documentId,
        baseRevisionId: work.revisionId,
        sequence: 1,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: "첫 원고".length,
        afterTextLengthUtf16: "첫 원고 이후 수정".length,
        changes: [{
          fromUtf16: "첫 원고".length,
          toUtf16: "첫 원고".length,
          insertedText: " 이후 수정",
        }],
      }));
      expect(laterReceipt).toHaveProperty("revisionId");
      expect((await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: work.workId,
      })).submissions).toEqual([updated]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: null,
      })).submissions).toEqual([updated]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists a Work-owned publishing contract linked to its matching submission", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-contract-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "별빛 아래",
        firstDocumentTitle: "1화",
      });
      const partner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "온라인 폼",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const submission = await runtime.createPublishingSubmission({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        title: "봄 투고",
        status: "접수",
        submittedOn: "2026-08-10",
        respondedOn: null,
        result: "",
        note: "",
        cardNote: "",
      });
      const created = await runtime.createPublishingContract({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        submissionId: submission.submissionId,
        title: "전자 출판 계약",
        status: "체결",
        signedOn: "2026-08-20",
        startsOn: "2026-09-01",
        endsOn: "2028-08-31",
        rightsScope: "국내 전자 출판권",
        advanceAmount: 1500000,
        currencyCode: "KRW",
        revenueShareNote: "순매출 기준",
        note: "원본 계약서는 별도 보관",
      });
      expect(created).toMatchObject({
        revision: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        submissionId: submission.submissionId,
        workTitleSnapshot: "별빛 아래",
        partnerNameSnapshot: "은하출판",
        title: "전자 출판 계약",
        advanceAmount: 1500000,
        currencyCode: "KRW",
      });
      const updated = await runtime.updatePublishingContract({
        schemaVersion: 1,
        contractId: created.contractId,
        expectedRevision: created.revision,
        changes: {
          status: "진행 중",
          signedOn: "2026-08-21",
          startsOn: "2026-09-02",
          endsOn: null,
          rightsScope: "국내 전자·오디오 출판권",
          advanceAmount: null,
          currencyCode: "KRW",
          revenueShareNote: "부속 합의 기준",
          note: "부속 합의 확인",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        submissionId: submission.submissionId,
        status: "진행 중",
        signedOn: "2026-08-21",
        startsOn: "2026-09-02",
        endsOn: null,
        rightsScope: "국내 전자·오디오 출판권",
        advanceAmount: null,
        revenueShareNote: "부속 합의 기준",
        note: "부속 합의 확인",
      });
      expect((await runtime.listPublishingContracts({
        schemaVersion: 1,
        workId: work.workId,
      })).contracts).toEqual([updated]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingContracts({
        schemaVersion: 1,
        workId: null,
      })).contracts).toEqual([updated]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists a Work-owned publication with independent contract and channel links", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-publication-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "별빛 아래",
        firstDocumentTitle: "1화",
      });
      const publisher = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const channel = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "별빛 연재관",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const contract = await runtime.createPublishingContract({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: publisher.partnerId,
        submissionId: null,
        title: "전자 출판 계약",
        status: "체결",
        signedOn: "2026-08-20",
        startsOn: null,
        endsOn: null,
        rightsScope: "국내 전자 출판권",
        advanceAmount: null,
        currencyCode: "",
        revenueShareNote: "",
        note: "",
      });
      const created = await runtime.createPublishingPublication({
        schemaVersion: 1,
        workId: work.workId,
        contractId: contract.contractId,
        channelPartnerId: channel.partnerId,
        title: "주 2회 연재",
        status: "연재 중",
        format: "웹 연재",
        scheduledOn: "2026-09-01",
        startsOn: "2026-09-03",
        endsOn: null,
        publishedUnitCount: 12,
        plannedUnitCount: 40,
        scheduleNote: "화·금 공개",
        note: "채널 공지 확인",
      });
      expect(created).toMatchObject({
        revision: 1,
        workId: work.workId,
        contractId: contract.contractId,
        channelPartnerId: channel.partnerId,
        workTitleSnapshot: "별빛 아래",
        channelNameSnapshot: "별빛 연재관",
        publishedUnitCount: 12,
        plannedUnitCount: 40,
      });
      const updated = await runtime.updatePublishingPublication({
        schemaVersion: 1,
        publicationId: created.publicationId,
        expectedRevision: created.revision,
        changes: {
          status: "휴재",
          format: "웹·앱 동시 연재",
          scheduledOn: null,
          startsOn: "2026-09-04",
          endsOn: "2026-12-31",
          publishedUnitCount: 13,
          plannedUnitCount: null,
          scheduleNote: "복귀일 미정",
          note: "13화까지 공개",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        contractId: contract.contractId,
        channelPartnerId: channel.partnerId,
        channelNameSnapshot: "별빛 연재관",
        status: "휴재",
        format: "웹·앱 동시 연재",
        scheduledOn: null,
        startsOn: "2026-09-04",
        endsOn: "2026-12-31",
        publishedUnitCount: 13,
        plannedUnitCount: null,
        scheduleNote: "복귀일 미정",
        note: "13화까지 공개",
      });
      expect((await runtime.listPublishingPublications({
        schemaVersion: 1,
        workId: work.workId,
      })).publications).toEqual([updated]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingPublications({
        schemaVersion: 1,
        workId: null,
      })).publications).toEqual([updated]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists a Work-owned settlement and its signed line items across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-settlement-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "별빛 아래",
        firstDocumentTitle: "1화",
      });
      const channel = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "별빛 연재관",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const publication = await runtime.createPublishingPublication({
        schemaVersion: 1,
        workId: work.workId,
        contractId: null,
        channelPartnerId: channel.partnerId,
        title: "주 2회 연재",
        status: "연재 중",
        format: "웹 연재",
        scheduledOn: null,
        startsOn: "2026-09-03",
        endsOn: null,
        publishedUnitCount: 12,
        plannedUnitCount: 40,
        scheduleNote: "",
        note: "",
      });
      const created = await runtime.createPublishingSettlement({
        schemaVersion: 1,
        workId: work.workId,
        publicationId: publication.publicationId,
        title: "9월 정산서",
        periodStartsOn: "2026-09-01",
        periodEndsOn: "2026-09-30",
        issuedOn: "2026-10-10",
        reviewStatus: "검토 중",
        currencyCode: "KRW",
        reportedAmount: 1250000,
        items: [],
        note: "원문 파일 별도 보관",
      });
      expect(created).toMatchObject({
        revision: 1,
        workId: work.workId,
        publicationId: publication.publicationId,
        workTitleSnapshot: "별빛 아래",
        publicationTitleSnapshot: "주 2회 연재",
        reportedAmount: 1250000,
        items: [],
      });
      const updated = await runtime.updatePublishingSettlement({
        schemaVersion: 1,
        settlementId: created.settlementId,
        expectedRevision: created.revision,
        changes: {
          periodStartsOn: "2026-09-02",
          periodEndsOn: "2026-10-01",
          issuedOn: null,
          reviewStatus: "확인 완료",
          currencyCode: "KRW",
          reportedAmount: 1240000,
          items: [{
            settlementLineItemId: null,
            label: "플랫폼 수수료 조정",
            amount: -10000,
            note: "명세서 반영",
          }],
          note: "차액 확인 완료",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        periodStartsOn: "2026-09-02",
        periodEndsOn: "2026-10-01",
        issuedOn: null,
        reviewStatus: "확인 완료",
        reportedAmount: 1240000,
        note: "차액 확인 완료",
        items: [{
          label: "플랫폼 수수료 조정",
          amount: -10000,
          note: "명세서 반영",
        }],
      });
      expect(updated.items[0]?.settlementLineItemId).toBeTruthy();
      expect((await runtime.listPublishingSettlements({
        schemaVersion: 1,
        workId: work.workId,
      })).settlements).toEqual([updated]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingSettlements({
        schemaVersion: 1,
        workId: null,
      })).settlements).toEqual([updated]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists an optional settlement-linked payment across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-payment-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "별빛 아래",
        firstDocumentTitle: "1화",
      });
      const channel = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "별빛 연재관",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const publication = await runtime.createPublishingPublication({
        schemaVersion: 1,
        workId: work.workId,
        contractId: null,
        channelPartnerId: channel.partnerId,
        title: "주 2회 연재",
        status: "연재 중",
        format: "웹 연재",
        scheduledOn: null,
        startsOn: "2026-09-03",
        endsOn: null,
        publishedUnitCount: 12,
        plannedUnitCount: 40,
        scheduleNote: "",
        note: "",
      });
      const settlement = await runtime.createPublishingSettlement({
        schemaVersion: 1,
        workId: work.workId,
        publicationId: publication.publicationId,
        title: "9월 정산서",
        periodStartsOn: "2026-09-01",
        periodEndsOn: "2026-09-30",
        issuedOn: "2026-10-10",
        reviewStatus: "확인 완료",
        currencyCode: "KRW",
        reportedAmount: 1250000,
        items: [],
        note: "",
      });
      const created = await runtime.createPublishingPayment({
        schemaVersion: 1,
        workId: work.workId,
        settlementId: settlement.settlementId,
        receivedOn: "2026-10-15",
        confirmedOn: null,
        amount: 600000,
        currencyCode: "KRW",
        matchStatus: "부분 입금",
        payerLabel: "별빛 연재관",
        reference: "BANK-2026-10",
        note: "1차 입금",
      });
      expect(created).toMatchObject({
        revision: 1,
        workId: work.workId,
        settlementId: settlement.settlementId,
        workTitleSnapshot: "별빛 아래",
        settlementTitleSnapshot: "9월 정산서",
        amount: 600000,
        currencyCode: "KRW",
      });
      const updated = await runtime.updatePublishingPayment({
        schemaVersion: 1,
        paymentId: created.paymentId,
        expectedRevision: created.revision,
        changes: {
          confirmedOn: "2026-10-16",
          amount: 590000,
          matchStatus: "확인 완료",
          payerLabel: "별빛 콘텐츠",
          reference: "BANK-2026-10-R1",
          note: "수수료 차감 확인",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        confirmedOn: "2026-10-16",
        amount: 590000,
        matchStatus: "확인 완료",
        payerLabel: "별빛 콘텐츠",
        reference: "BANK-2026-10-R1",
        note: "수수료 차감 확인",
      });
      expect((await runtime.listPublishingPayments({
        schemaVersion: 1,
        workId: work.workId,
      })).payments).toEqual([updated]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingPayments({
        schemaVersion: 1,
        workId: null,
      })).payments).toEqual([updated]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists a Studio-shared publishing source across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-source-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const source = await runtime.createPublishingSource({
        schemaVersion: 1,
        kind: "사용자 진술",
        label: "계약서 원본 확인",
        url: null,
        observedAt: "2026-10-16T03:30:00.000Z",
        authority: "직접 확인",
        importedFields: { 원본열: "보존값" },
      });
      expect(source).toMatchObject({
        revision: 1,
        kind: "사용자 진술",
        label: "계약서 원본 확인",
        url: null,
        observedAt: "2026-10-16T03:30:00.000Z",
        authority: "직접 확인",
        importedFields: { 원본열: "보존값" },
      });
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual([source]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual([source]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("approves only selected publishing research fields and links the source atomically", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-research-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const partner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "이메일",
        websiteUrl: "https://old.example/",
        email: "old@example.test",
        genres: ["판타지"],
        requiredLength: "",
        priority: "",
        note: "기존 메모",
      });
      const preview = await runtime.previewPublishingResearch({
        schemaVersion: 1,
        partnerId: partner.partnerId,
        source: {
          label: "공식 투고 안내",
          url: "https://publisher.example/submissions",
          observedOn: "2026-08-10",
          authority: "공식 홈페이지",
        },
        proposals: {
          websiteUrl: "https://publisher.example/submit",
          email: "new@example.test",
          genres: ["판타지", "로맨스"],
          note: "새 메모",
        },
      });

      const approved = await runtime.approvePublishingResearch({
        schemaVersion: 1,
        partnerId: partner.partnerId,
        expectedRevision: preview.expectedRevision,
        source: preview.source,
        proposals: preview.proposals,
        selectedFields: ["websiteUrl", "genres"],
      });
      expect(approved.partner).toMatchObject({
        revision: 2,
        websiteUrl: "https://publisher.example/submit",
        email: "old@example.test",
        genres: ["판타지", "로맨스"],
        note: "기존 메모",
        sourceIds: [approved.source.sourceId],
      });
      expect(approved.source).toMatchObject({
        revision: 1,
        kind: "web",
        label: "공식 투고 안내",
        url: "https://publisher.example/submissions",
        observedAt: "2026-08-10T00:00:00.000Z",
        authority: "공식 홈페이지",
        importedFields: {
          websiteUrl: "https://publisher.example/submit",
          email: "new@example.test",
          genres: "[\"판타지\",\"로맨스\"]",
          note: "새 메모",
        },
      });

      await expect(runtime.approvePublishingResearch({
        schemaVersion: 1,
        partnerId: partner.partnerId,
        expectedRevision: preview.expectedRevision,
        source: preview.source,
        proposals: preview.proposals,
        selectedFields: ["email"],
      })).rejects.toThrow(`Publishing partner revision conflict: ${partner.partnerId}`);
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual([approved.source]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingPartners({ schemaVersion: 1 })).partners)
        .toEqual([approved.partner]);
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual([approved.source]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("links and unlinks one shared publishing source across every publishing record kind", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-evidence-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "별빛 아래",
        firstDocumentTitle: "1화",
      });
      const partner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "은하출판",
        parentPartnerId: null,
        submissionMethod: "온라인 폼",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const submission = await runtime.createPublishingSubmission({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        title: "봄 투고",
        status: "접수",
        submittedOn: "2026-08-10",
        respondedOn: null,
        result: "",
        note: "",
        cardNote: "",
      });
      const contract = await runtime.createPublishingContract({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        submissionId: submission.submissionId,
        title: "전자 출판 계약",
        status: "체결",
        signedOn: "2026-08-20",
        startsOn: null,
        endsOn: null,
        rightsScope: "국내 전자 출판권",
        advanceAmount: null,
        currencyCode: "",
        revenueShareNote: "",
        note: "",
      });
      const publication = await runtime.createPublishingPublication({
        schemaVersion: 1,
        workId: work.workId,
        contractId: contract.contractId,
        channelPartnerId: partner.partnerId,
        title: "주 2회 연재",
        status: "연재 중",
        format: "웹 연재",
        scheduledOn: null,
        startsOn: "2026-09-03",
        endsOn: null,
        publishedUnitCount: 1,
        plannedUnitCount: null,
        scheduleNote: "",
        note: "",
      });
      const settlement = await runtime.createPublishingSettlement({
        schemaVersion: 1,
        workId: work.workId,
        publicationId: publication.publicationId,
        title: "9월 정산서",
        periodStartsOn: "2026-09-01",
        periodEndsOn: "2026-09-30",
        issuedOn: "2026-10-10",
        reviewStatus: "확인 완료",
        currencyCode: "KRW",
        reportedAmount: 1000,
        items: [],
        note: "",
      });
      const payment = await runtime.createPublishingPayment({
        schemaVersion: 1,
        workId: work.workId,
        settlementId: settlement.settlementId,
        receivedOn: "2026-10-15",
        confirmedOn: null,
        amount: 1000,
        currencyCode: "KRW",
        matchStatus: "확인 완료",
        payerLabel: "은하출판",
        reference: "",
        note: "",
      });
      const source = await runtime.createPublishingSource({
        schemaVersion: 1,
        kind: "공식 문서",
        label: "계약·정산 원본",
        url: null,
        observedAt: "2026-10-16T03:30:00.000Z",
        authority: "직접 확인",
        importedFields: {},
      });

      const targets = [
        { targetKind: "partner", targetId: partner.partnerId },
        { targetKind: "submission", targetId: submission.submissionId },
        { targetKind: "contract", targetId: contract.contractId },
        { targetKind: "publication", targetId: publication.publicationId },
        { targetKind: "settlement", targetId: settlement.settlementId },
        { targetKind: "payment", targetId: payment.paymentId },
      ] as const;
      for (const target of targets) {
        await expect(runtime.setPublishingEvidenceLinks({
          schemaVersion: 1,
          ...target,
          expectedRevision: 1,
          sourceIds: [source.sourceId],
        })).resolves.toMatchObject({
          ...target,
          revision: 2,
          sourceIds: [source.sourceId],
        });
      }
      await expect(runtime.setPublishingEvidenceLinks({
        schemaVersion: 1,
        targetKind: "payment",
        targetId: payment.paymentId,
        expectedRevision: 2,
        sourceIds: [],
      })).resolves.toMatchObject({ revision: 3, sourceIds: [] });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const restored = [
        (await runtime.listPublishingPartners({ schemaVersion: 1 })).partners[0],
        (await runtime.listPublishingSubmissions({ schemaVersion: 1, workId: null })).submissions[0],
        (await runtime.listPublishingContracts({ schemaVersion: 1, workId: null })).contracts[0],
        (await runtime.listPublishingPublications({ schemaVersion: 1, workId: null })).publications[0],
        (await runtime.listPublishingSettlements({ schemaVersion: 1, workId: null })).settlements[0],
        (await runtime.listPublishingPayments({ schemaVersion: 1, workId: null })).payments[0],
      ];
      expect(restored.slice(0, 5).map((record) => record?.sourceIds))
        .toEqual(Array.from({ length: 5 }, () => [source.sourceId]));
      expect(restored[5]?.sourceIds).toEqual([]);
      expect(restored.map((record) => record?.revision)).toEqual([2, 2, 2, 2, 2, 3]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("applies only approved publishing partner CSV rows with raw source provenance across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-partner-csv-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const existing = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "기존 출판사",
        parentPartnerId: null,
        submissionMethod: "이메일",
        websiteUrl: "",
        email: "old@example.test",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "기존 메모 유지",
      });
      const result = await runtime.applyPublishingPartnerCsvImport({
        schemaVersion: 1,
        fileName: "투고처.csv",
        csvText: [
          "이름,모출판사,이메일,장르,원시열",
          "기존 출판사,,new@example.test,판타지,기존행",
          "새 문고,기존 출판사,child@example.test,로맨스,신규행",
          ",,missing@example.test,,문제행",
        ].join("\r\n"),
        mapping: {
          name: "이름",
          parentPartnerName: "모출판사",
          email: "이메일",
          genres: "장르",
        },
      });
      expect(result).toMatchObject({
        importedCount: 2,
        createdCount: 1,
        updatedCount: 1,
        skippedRowNumbers: [4],
      });
      const partners = (await runtime.listPublishingPartners({ schemaVersion: 1 })).partners;
      const updated = partners.find((partner) => partner.partnerId === existing.partnerId);
      const child = partners.find((partner) => partner.name === "새 문고");
      expect(updated).toMatchObject({
        revision: 2,
        email: "new@example.test",
        genres: ["판타지"],
        note: "기존 메모 유지",
      });
      expect(child).toMatchObject({
        revision: 1,
        parentPartnerId: existing.partnerId,
        email: "child@example.test",
        genres: ["로맨스"],
      });
      expect(updated?.sourceIds).toHaveLength(1);
      expect(child?.sourceIds).toHaveLength(1);
      const sources = (await runtime.listPublishingSources({ schemaVersion: 1 })).sources;
      expect(sources).toHaveLength(2);
      expect(sources.map((source) => source.importedFields.원시열).sort())
        .toEqual(["기존행", "신규행"]);
      expect(sources.every((source) => source.kind === "text/csv")).toBe(true);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const restoredPartners = (
        await runtime.listPublishingPartners({ schemaVersion: 1 })
      ).partners;
      expect(restoredPartners.find((partner) => partner.partnerId === existing.partnerId))
        .toEqual(updated);
      expect(restoredPartners.find((partner) => partner.name === "새 문고"))
        .toEqual(child);
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual(sources);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("applies approved submission CSV rows with current immutable packages and raw sources across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-submission-csv-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "긴 여름",
        firstDocumentTitle: "1화",
      });
      const saved = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: work.workId,
        documentId: work.documentId,
        baseRevisionId: work.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: "현재 제출 원고".length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: "현재 제출 원고" }],
      }));
      if (!("revisionId" in saved)) throw new Error("CSV setup must save current revision");
      const partner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: "한빛 문고",
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const result = await runtime.applyPublishingSubmissionCsvImport({
        schemaVersion: 1,
        fileName: "투고 이력.csv",
        csvText: [
          "작품,투고처,제목,투고일,상태,메모,원시열",
          "긴 여름,한빛 문고,첫 투고,2026-08-10,접수,접수 번호 보관,보존값",
          "없는 작품,한빛 문고,제외,2026-08-11,대기,,제외값",
        ].join("\r\n"),
        mapping: {
          workLabel: "작품",
          partnerLabel: "투고처",
          title: "제목",
          submittedOn: "투고일",
          status: "상태",
          note: "메모",
        },
      });
      expect(result).toMatchObject({ importedCount: 1, skippedRowNumbers: [3] });
      const submissions = (await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: work.workId,
      })).submissions;
      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toMatchObject({
        workId: work.workId,
        partnerId: partner.partnerId,
        title: "첫 투고",
        status: "접수",
        submittedOn: "2026-08-10",
        note: "접수 번호 보관",
        sourceIds: result.sourceIds,
        package: {
          submissionPackageId: result.submissionPackageIds[0],
          documentRevisions: [{
            documentId: work.documentId,
            documentRevisionId: saved.revisionId,
          }],
        },
      });
      const sources = (await runtime.listPublishingSources({ schemaVersion: 1 })).sources;
      expect(sources).toHaveLength(1);
      expect(sources[0]).toMatchObject({
        sourceId: result.sourceIds[0],
        kind: "text/csv",
        label: "투고 이력.csv · 2행",
        importedFields: {
          작품: "긴 여름",
          투고처: "한빛 문고",
          제목: "첫 투고",
          투고일: "2026-08-10",
          상태: "접수",
          메모: "접수 번호 보관",
          원시열: "보존값",
        },
      });
      const sealedPackage = submissions[0]?.package;

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: null,
      })).submissions[0]?.package).toEqual(sealedPackage);
      expect((await runtime.listPublishingSources({ schemaVersion: 1 })).sources)
        .toEqual(sources);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists metadata-only mail candidates and applies an explicitly linked proposal across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-publishing-mail-candidate-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const workTitle = randomUUID();
      const partnerName = randomUUID();
      const work = await runtime.createFirstWork({
        schemaVersion: 1,
        title: workTitle,
        firstDocumentTitle: randomUUID(),
      });
      const partner = await runtime.createPublishingPartner({
        schemaVersion: 1,
        name: partnerName,
        parentPartnerId: null,
        submissionMethod: "",
        websiteUrl: "",
        email: "",
        genres: [],
        requiredLength: "",
        priority: "",
        note: "",
      });
      const submission = await runtime.createPublishingSubmission({
        schemaVersion: 1,
        workId: work.workId,
        partnerId: partner.partnerId,
        title: randomUUID(),
        status: "접수",
        submittedOn: "2026-08-10",
        respondedOn: null,
        result: "",
        note: "",
        cardNote: "",
      });
      const sealedPackage = submission.package;
      const recordCommand = {
        schemaVersion: 1 as const,
        sourceAccountId: randomUUID(),
        messageId: randomUUID(),
        threadId: randomUUID(),
        from: "editor@example.test",
        subject: randomUUID(),
        receivedAt: "2026-08-12T02:30:00.000Z",
        snippet: randomUUID(),
        bodyFingerprint: randomUUID(),
        matchReason: "사용자 검토 대기",
        proposedStatus: "회신 완료",
        proposedResult: "수정 요청",
        proposedRespondedOn: "2026-08-12",
        proposedNote: "첫 제안",
        classificationConnectionId: null,
        classificationModel: "",
      };
      const candidate = await runtime.recordPublishingMailCandidate(recordCommand);
      expect(candidate).toMatchObject({
        revision: 1,
        submissionId: null,
        partnerId: null,
        reviewStatus: "needs-link",
      });
      await expect(runtime.recordPublishingMailCandidate(recordCommand))
        .resolves.toEqual(candidate);
      expect((await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: work.workId,
      })).submissions[0]).toEqual(submission);

      const source = (await runtime.listPublishingSources({ schemaVersion: 1 }))
        .sources.find((item) => item.sourceId === candidate.sourceId);
      expect(source).toMatchObject({
        kind: "message/metadata",
        label: recordCommand.messageId,
        authority: recordCommand.sourceAccountId,
        importedFields: {
          sourceAccountId: recordCommand.sourceAccountId,
          messageId: recordCommand.messageId,
          threadId: recordCommand.threadId,
          from: recordCommand.from,
          subject: recordCommand.subject,
          receivedAt: recordCommand.receivedAt,
          snippet: recordCommand.snippet,
          bodyFingerprint: recordCommand.bodyFingerprint,
        },
      });
      expect(source?.importedFields).not.toHaveProperty("body");

      const linked = await runtime.linkPublishingMailCandidate({
        schemaVersion: 1,
        candidateId: candidate.candidateId,
        expectedRevision: candidate.revision,
        submissionId: submission.submissionId,
      });
      expect(linked).toMatchObject({
        revision: 2,
        submissionId: submission.submissionId,
        partnerId: partner.partnerId,
        reviewStatus: "unreviewed",
      });
      const updatedCandidate = await runtime.updatePublishingMailCandidate({
        schemaVersion: 1,
        candidateId: linked.candidateId,
        expectedRevision: linked.revision,
        changes: {
          proposedStatus: "회신 확인",
          proposedResult: "수정 후 재검토",
          proposedRespondedOn: "2026-08-13",
          proposedNote: "사용자가 확인한 회신 요약",
        },
      });
      expect(updatedCandidate).toMatchObject({
        revision: 3,
        proposedStatus: "회신 확인",
        proposedResult: "수정 후 재검토",
        proposedRespondedOn: "2026-08-13",
        proposedNote: "사용자가 확인한 회신 요약",
      });
      const approved = await runtime.reviewPublishingMailCandidate({
        schemaVersion: 1,
        candidateId: updatedCandidate.candidateId,
        expectedRevision: updatedCandidate.revision,
        decision: "approve",
      });
      expect(approved.candidate).toMatchObject({ revision: 4, reviewStatus: "approved" });
      expect(approved.submission).toMatchObject({
        revision: 2,
        status: "회신 확인",
        respondedOn: "2026-08-13",
        result: "수정 후 재검토",
        note: "사용자가 확인한 회신 요약",
        sourceIds: [candidate.sourceId],
      });
      expect(approved.submission?.package).toEqual(sealedPackage);

      const ignoredCandidate = await runtime.recordPublishingMailCandidate({
        ...recordCommand,
        messageId: randomUUID(),
        threadId: randomUUID(),
        receivedAt: "2026-08-14T02:30:00.000Z",
      });
      const ignored = await runtime.reviewPublishingMailCandidate({
        schemaVersion: 1,
        candidateId: ignoredCandidate.candidateId,
        expectedRevision: ignoredCandidate.revision,
        decision: "ignore",
      });
      expect(ignored).toMatchObject({
        candidate: { revision: 2, reviewStatus: "ignored" },
        submission: null,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopenedCandidates = (await runtime.listPublishingMailCandidates({
        schemaVersion: 1,
      })).candidates;
      expect(reopenedCandidates.find((item) => item.candidateId === candidate.candidateId))
        .toEqual(approved.candidate);
      expect(reopenedCandidates.find((item) => item.candidateId === ignoredCandidate.candidateId))
        .toEqual(ignored.candidate);
      const reopenedSubmission = (await runtime.listPublishingSubmissions({
        schemaVersion: 1,
        workId: work.workId,
      })).submissions[0];
      expect(reopenedSubmission).toEqual(approved.submission);
      expect(reopenedSubmission?.package).toEqual(sealedPackage);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned plot metadata and soft-retires it across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const created = await runtime.createPlotThread({
        schemaVersion: 1,
        workId: first.workId,
        title: "사라진 기록",
        stage: "",
        summary: "기록의 행방을 추적한다.",
        note: "3화 단서 확인",
      });

      expect(created).toMatchObject({
        revision: 1,
        workId: first.workId,
        title: "사라진 기록",
        stage: "",
        summary: "기록의 행방을 추적한다.",
        note: "3화 단서 확인",
        retiredAt: null,
      });
      expect((await runtime.listPlotThreads({
        schemaVersion: 1,
        workId: first.workId,
      })).plots).toEqual([created]);
      await expect(runtime.listPlotThreads({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({ plots: [] });
      await expect(runtime.updatePlotThread({
        schemaVersion: 1,
        workId: second.workId,
        plotThreadId: created.plotThreadId,
        expectedRevision: 1,
        changes: { stage: "다른 작품에서 바꾸기" },
      })).rejects.toThrow("Work/plot boundary violation");

      const updated = await runtime.updatePlotThread({
        schemaVersion: 1,
        workId: first.workId,
        plotThreadId: created.plotThreadId,
        expectedRevision: 1,
        changes: {
          title: "돌아온 기록",
          stage: "회수",
          summary: "기록이 돌아온 이유를 밝힌다.",
          note: "결말 직전 확인",
        },
      });
      expect(updated).toMatchObject({
        revision: 2,
        title: "돌아온 기록",
        stage: "회수",
        summary: "기록이 돌아온 이유를 밝힌다.",
        note: "결말 직전 확인",
      });
      await expect(runtime.updatePlotThread({
        schemaVersion: 1,
        workId: first.workId,
        plotThreadId: created.plotThreadId,
        expectedRevision: 1,
        changes: { note: "stale" },
      })).rejects.toThrow("Plot revision conflict");
      await expect(runtime.retirePlotThread({
        schemaVersion: 1,
        workId: second.workId,
        plotThreadId: created.plotThreadId,
        expectedRevision: 2,
      })).rejects.toThrow("Work/plot boundary violation");

      const retired = await runtime.retirePlotThread({
        schemaVersion: 1,
        workId: first.workId,
        plotThreadId: created.plotThreadId,
        expectedRevision: 2,
      });
      expect(retired).toMatchObject({ revision: 3 });
      expect(retired.retiredAt).not.toBeNull();
      expect((await runtime.listPlotThreads({
        schemaVersion: 1,
        workId: first.workId,
      })).plots).toEqual([]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPlotThreads({
        schemaVersion: 1,
        workId: first.workId,
      })).plots).toEqual([]);
      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(database.prepare(
          "SELECT title, stage, summary, note, retired_at AS retiredAt FROM plot_threads WHERE id = ?",
        ).get(created.plotThreadId)).toMatchObject({
          title: "돌아온 기록",
          stage: "회수",
          summary: "기록이 돌아온 이유를 밝힌다.",
          note: "결말 직전 확인",
          retiredAt: retired.retiredAt,
        });
      } finally {
        database.close();
      }
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates, reuses, unlinks, and restores Work-owned plot/event links across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-event-link-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "첫 사건의 정확한 원문과 플롯에서 만들 둘째 사건 원문";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));

      const firstQuote = "첫 사건의 정확한 원문";
      const firstFrom = manuscript.indexOf(firstQuote);
      const firstEvent = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: {
          anchor: firstFrom,
          head: firstFrom + firstQuote.length,
        },
        exactQuote: firstQuote,
        title: "첫 사건",
        note: "첫 사건 메모",
      });
      const fromEvent = await runtime.createPlotFromEvent({
        schemaVersion: 1,
        workId: created.workId,
        eventBlockId: firstEvent.eventBlockId,
      });
      expect(fromEvent).toMatchObject({
        status: "created",
        plotBeat: { title: "첫 사건", summary: "첫 사건 메모" },
        eventBlock: { eventBlockId: firstEvent.eventBlockId, title: "첫 사건" },
        eventSources: [{ anchors: [{ exactQuote: firstQuote }] }],
        link: {
          role: "primary",
          createdFrom: "event-to-plot",
          titleMatch: "matched",
        },
      });
      const reusedFromEvent = await runtime.createPlotFromEvent({
        schemaVersion: 1,
        workId: created.workId,
        eventBlockId: firstEvent.eventBlockId,
      });
      expect(reusedFromEvent).toMatchObject({
        status: "existing",
        plotBeat: { plotThreadId: fromEvent.plotBeat.plotThreadId },
        link: { plotEventLinkId: fromEvent.link.plotEventLinkId },
      });

      await runtime.updatePlotThread({
        schemaVersion: 1,
        workId: created.workId,
        plotThreadId: fromEvent.plotBeat.plotThreadId,
        expectedRevision: fromEvent.plotBeat.revision,
        changes: { title: "독립적으로 바뀐 플롯 제목" },
      });
      let links = await runtime.listPlotEventLinks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(links.links[0]).toMatchObject({
        plotTitle: "독립적으로 바뀐 플롯 제목",
        eventTitle: "첫 사건",
        titleMatch: "mismatched",
      });

      const supportingEvent = await runtime.createAnchorlessEvent({
        schemaVersion: 1,
        workId: created.workId,
        title: "보조 사건",
        note: "연결 해제 후에도 남는다",
      });
      const supporting = await runtime.linkPlotEvent({
        schemaVersion: 1,
        workId: created.workId,
        plotBeatId: fromEvent.plotBeat.plotThreadId,
        eventBlockId: supportingEvent.eventBlockId,
        role: "supporting",
      });
      expect(supporting).toMatchObject({
        status: "created",
        link: { role: "supporting", createdFrom: "manual-link" },
      });
      const reusedSupporting = await runtime.linkPlotEvent({
        schemaVersion: 1,
        workId: created.workId,
        plotBeatId: fromEvent.plotBeat.plotThreadId,
        eventBlockId: supportingEvent.eventBlockId,
        role: "supporting",
      });
      expect(reusedSupporting).toMatchObject({
        status: "existing",
        link: { plotEventLinkId: supporting.link.plotEventLinkId },
      });

      const unlinked = await runtime.unlinkPlotEvent({
        schemaVersion: 1,
        workId: created.workId,
        plotEventLinkId: supporting.link.plotEventLinkId,
        expectedRevision: supporting.link.revision,
      });
      expect(unlinked).toMatchObject({ status: "retired", link: { revision: 2 } });
      expect(unlinked.link.retiredAt).not.toBeNull();
      expect((await runtime.listPlotThreads({
        schemaVersion: 1,
        workId: created.workId,
      })).plots).toContainEqual(expect.objectContaining({
        plotThreadId: fromEvent.plotBeat.plotThreadId,
      }));
      expect((await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      })).eventBlocks).toContainEqual(supportingEvent);

      const relinked = await runtime.linkPlotEvent({
        schemaVersion: 1,
        workId: created.workId,
        plotBeatId: fromEvent.plotBeat.plotThreadId,
        eventBlockId: supportingEvent.eventBlockId,
        role: "supporting",
      });
      expect(relinked.link.plotEventLinkId).not.toBe(supporting.link.plotEventLinkId);

      const plannedPlot = await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "예정 플롯",
        stage: "",
        summary: "아직 원고 근거 없음",
        note: "",
      });
      const anchorlessFromPlot = await runtime.createEventFromPlot({
        schemaVersion: 1,
        workId: created.workId,
        plotBeatId: plannedPlot.plotThreadId,
        source: { kind: "anchorless" },
      });
      expect(anchorlessFromPlot).toMatchObject({
        status: "created",
        eventBlock: { title: "예정 플롯", note: "아직 원고 근거 없음" },
        eventSources: [],
        link: { role: "primary", createdFrom: "plot-to-event" },
      });
      expect(await runtime.createEventFromPlot({
        schemaVersion: 1,
        workId: created.workId,
        plotBeatId: plannedPlot.plotThreadId,
        source: { kind: "anchorless" },
      })).toMatchObject({
        status: "existing",
        eventBlock: { eventBlockId: anchorlessFromPlot.eventBlock.eventBlockId },
      });

      const exactPlot = await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "둘째 사건",
        stage: "",
        summary: "선택 근거 포함",
        note: "",
      });
      const secondQuote = "플롯에서 만들 둘째 사건 원문";
      const secondFrom = manuscript.indexOf(secondQuote);
      const exactFromPlot = await runtime.createEventFromPlot({
        schemaVersion: 1,
        workId: created.workId,
        plotBeatId: exactPlot.plotThreadId,
        source: {
          kind: "exact-selection",
          documentId: created.documentId,
          selection: {
            anchor: secondFrom + secondQuote.length,
            head: secondFrom,
          },
          exactQuote: secondQuote,
        },
      });
      expect(exactFromPlot).toMatchObject({
        status: "created",
        eventBlock: { title: "둘째 사건", note: "선택 근거 포함" },
        eventSources: [{
          role: "primary",
          anchors: [{
            exactQuote: secondQuote,
            integrity: "resolved",
            range: { from: secondFrom, to: secondFrom + secondQuote.length },
          }],
        }],
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      links = await runtime.listPlotEventLinks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(links.links).toHaveLength(4);
      expect(links.links).toEqual(expect.arrayContaining([
        expect.objectContaining({
          plotEventLinkId: fromEvent.link.plotEventLinkId,
          titleMatch: "mismatched",
        }),
        expect.objectContaining({
          plotEventLinkId: relinked.link.plotEventLinkId,
          role: "supporting",
        }),
        expect.objectContaining({
          plotEventLinkId: anchorlessFromPlot.link.plotEventLinkId,
        }),
        expect.objectContaining({
          plotEventLinkId: exactFromPlot.link.plotEventLinkId,
        }),
      ]));

      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const audit = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(audit.prepare(`
          SELECT
            SUM(CASE WHEN retired_at IS NULL THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN retired_at IS NOT NULL THEN 1 ELSE 0 END) AS retired
          FROM plot_event_links
        `).get()).toEqual({ active: 4, retired: 1 });
        expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        audit.close();
      }
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("moves only a PlotPlacement and preserves exact manuscript and event evidence across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-board-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    const readUnchangedContent = () => {
      const database = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        return Object.freeze({
          revisions: database.prepare(
            "SELECT * FROM document_revisions ORDER BY work_id, document_id, id",
          ).all(),
          anchors: database.prepare(
            "SELECT * FROM anchors ORDER BY work_id, document_id, id",
          ).all(),
          rangeGroups: database.prepare(
            "SELECT * FROM range_groups ORDER BY work_id, id",
          ).all(),
          eventSources: database.prepare(
            "SELECT * FROM event_sources ORDER BY work_id, event_block_id, id",
          ).all(),
          eventBlocks: database.prepare(
            "SELECT * FROM event_blocks ORDER BY work_id, id",
          ).all(),
          plots: database.prepare(
            "SELECT * FROM plot_threads ORDER BY work_id, id",
          ).all(),
          plotEventLinks: database.prepare(
            "SELECT * FROM plot_event_links ORDER BY work_id, id",
          ).all(),
        });
      } finally {
        database.close();
      }
    };

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "첫 장면의 사건 원문 다음에 둘째 장면의 사건 원문이 이어진다.";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      const createEvent = async (exactQuote: string, title: string) => {
        const from = manuscript.indexOf(exactQuote);
        return runtime.createEventBlock({
          schemaVersion: 1,
          workId: created.workId,
          documentId: created.documentId,
          selection: { anchor: from, head: from + exactQuote.length },
          exactQuote,
          title,
          note: "",
        });
      };
      const firstEvent = await createEvent("첫 장면의 사건 원문", "첫 사건");
      const secondEvent = await createEvent("둘째 장면의 사건 원문", "둘째 사건");
      const firstPlot = await runtime.createPlotFromEvent({
        schemaVersion: 1,
        workId: created.workId,
        eventBlockId: firstEvent.eventBlockId,
      });
      const secondPlot = await runtime.createPlotFromEvent({
        schemaVersion: 1,
        workId: created.workId,
        eventBlockId: secondEvent.eventBlockId,
      });

      const boardBefore = await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(boardBefore.lanes).toHaveLength(1);
      const laneBefore = boardBefore.lanes[0]!;
      expect(laneBefore.placements.map((placement) => placement.plotBeatId))
        .toEqual([
          firstPlot.plotBeat.plotThreadId,
          secondPlot.plotBeat.plotThreadId,
        ]);
      const firstPlacement = laneBefore.placements[0]!;
      const secondPlacement = laneBefore.placements[1]!;
      const contentBefore = readUnchangedContent();

      const boardAfter = await runtime.movePlotPlacement({
        schemaVersion: 1,
        workId: created.workId,
        plotPlacementId: secondPlacement.plotPlacementId,
        targetBoardId: boardBefore.plotBoardId,
        targetLaneId: laneBefore.plotLaneId,
        afterPlacementId: firstPlacement.plotPlacementId,
        expectedPlacementRevision: secondPlacement.revision,
        expectedBoardRevision: boardBefore.revision,
      });
      expect(boardAfter.revision).toBe(boardBefore.revision + 1);
      expect(boardAfter.lanes[0]!.placements.map((placement) => placement.plotBeatId))
        .toEqual([
          secondPlot.plotBeat.plotThreadId,
          firstPlot.plotBeat.plotThreadId,
        ]);
      expect(readUnchangedContent()).toEqual(contentBefore);

      const audit = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        const placementRows = audit.prepare(
          "SELECT id, revision, order_key AS \"orderKey\" FROM plot_placements WHERE work_id = ? AND retired_at IS NULL ORDER BY id",
        ).all(created.workId);
        expect(placementRows.find((row) => row.id === firstPlacement.plotPlacementId))
          .toEqual({
            id: firstPlacement.plotPlacementId,
            revision: firstPlacement.revision,
            orderKey: firstPlacement.orderKey,
          });
        expect(placementRows.find((row) => row.id === secondPlacement.plotPlacementId))
          .toEqual(expect.objectContaining({
            id: secondPlacement.plotPlacementId,
            revision: secondPlacement.revision + 1,
          }));
        expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        audit.close();
      }

      await runtime.unlinkPlotEvent({
        schemaVersion: 1,
        workId: created.workId,
        plotEventLinkId: secondPlot.link.plotEventLinkId,
        expectedRevision: secondPlot.link.revision,
      });
      expect((await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      })).lanes[0]!.placements).toHaveLength(2);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopenedBoard = await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopenedBoard.lanes[0]!.placements.map(
        (placement) => placement.plotBeatId,
      )).toEqual([
        secondPlot.plotBeat.plotThreadId,
        firstPlot.plotBeat.plotThreadId,
      ]);
      const reopenedEvents = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopenedEvents.eventSources.map((source) =>
        source.anchors[0]?.exactQuote,
      )).toEqual(expect.arrayContaining([
        "첫 장면의 사건 원문",
        "둘째 장면의 사건 원문",
      ]));
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("stores only unsnapped normalized story time, permits overlap, and preserves plot order across restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-story-time-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "시간 플롯 A",
        stage: "",
        summary: "",
        note: "",
      });
      await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "시간 플롯 B",
        stage: "",
        summary: "",
        note: "",
      });
      await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "시간 플롯 C",
        stage: "",
        summary: "",
        note: "",
      });

      const boardBefore = await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      });
      const placementsBefore = boardBefore.lanes[0]!.placements;
      const [first, second, third] = placementsBefore;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(third).toBeDefined();
      const orderBefore = placementsBefore.map((placement) => ({
        id: placement.plotPlacementId,
        orderKey: placement.orderKey,
      }));

      const firstTime = 37.416666666666664;
      let board = await runtime.setPlotPlacementStoryTime({
        schemaVersion: 1,
        workId: created.workId,
        plotPlacementId: first!.plotPlacementId,
        plotBoardId: boardBefore.plotBoardId,
        storyTime: firstTime,
        storyTimeEnd: null,
        expectedPlacementRevision: first!.revision,
        expectedBoardRevision: boardBefore.revision,
      });
      expect(board.revision).toBe(boardBefore.revision + 1);
      expect(board.lanes[0]!.placements[0]).toMatchObject({
        plotPlacementId: first!.plotPlacementId,
        revision: first!.revision + 1,
        storyTime: firstTime,
        storyTimeEnd: null,
      });
      expect(board.lanes[0]!.placements[1]).toMatchObject({
        plotPlacementId: second!.plotPlacementId,
        revision: second!.revision,
        storyTime: null,
      });

      board = await runtime.setPlotPlacementStoryTime({
        schemaVersion: 1,
        workId: created.workId,
        plotPlacementId: second!.plotPlacementId,
        plotBoardId: board.plotBoardId,
        storyTime: firstTime,
        storyTimeEnd: null,
        expectedPlacementRevision: second!.revision,
        expectedBoardRevision: board.revision,
      });
      board = await runtime.setPlotPlacementStoryTime({
        schemaVersion: 1,
        workId: created.workId,
        plotPlacementId: third!.plotPlacementId,
        plotBoardId: board.plotBoardId,
        storyTime: 70.125,
        storyTimeEnd: 92.875,
        expectedPlacementRevision: third!.revision,
        expectedBoardRevision: board.revision,
      });
      expect(board.lanes[0]!.placements.map((placement) => ({
        id: placement.plotPlacementId,
        orderKey: placement.orderKey,
      }))).toEqual(orderBefore);
      expect(board.lanes[0]!.placements.map((placement) => placement.storyTime))
        .toEqual([firstTime, firstTime, 70.125]);

      const boardBeforeConflict = board;
      await expect(runtime.setPlotPlacementStoryTime({
        schemaVersion: 1,
        workId: created.workId,
        plotPlacementId: first!.plotPlacementId,
        plotBoardId: board.plotBoardId,
        storyTime: 88.8125,
        storyTimeEnd: null,
        expectedPlacementRevision: first!.revision,
        expectedBoardRevision: board.revision,
      })).rejects.toThrow(/PlotPlacement revision conflict/);
      expect(await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      })).toEqual(boardBeforeConflict);

      const audit = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(audit.prepare(`
          SELECT
            id,
            order_key AS "orderKey",
            story_time AS "storyTime",
            story_time_end AS "storyTimeEnd"
          FROM plot_placements
          WHERE work_id = ? AND retired_at IS NULL
          ORDER BY order_key
        `).all(created.workId)).toEqual([
          {
            id: first!.plotPlacementId,
            orderKey: first!.orderKey,
            storyTime: firstTime,
            storyTimeEnd: null,
          },
          {
            id: second!.plotPlacementId,
            orderKey: second!.orderKey,
            storyTime: firstTime,
            storyTimeEnd: null,
          },
          {
            id: third!.plotPlacementId,
            orderKey: third!.orderKey,
            storyTime: 70.125,
            storyTimeEnd: 92.875,
          },
        ]);
        expect(
          audit.prepare("PRAGMA table_info(plot_placements)").all()
            .map((column) => column.name)
            .filter((name) => /pixel|screen|client/i.test(String(name))),
        ).toEqual([]);
      } finally {
        audit.close();
      }

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.lanes[0]!.placements.map((placement) => ({
        id: placement.plotPlacementId,
        orderKey: placement.orderKey,
        storyTime: placement.storyTime,
        storyTimeEnd: placement.storyTimeEnd,
      }))).toEqual([
        {
          id: first!.plotPlacementId,
          orderKey: first!.orderKey,
          storyTime: firstTime,
          storyTimeEnd: null,
        },
        {
          id: second!.plotPlacementId,
          orderKey: second!.orderKey,
          storyTime: firstTime,
          storyTimeEnd: null,
        },
        {
          id: third!.plotPlacementId,
          orderKey: third!.orderKey,
          storyTime: 70.125,
          storyTimeEnd: 92.875,
        },
      ]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("projects Work-global manuscript order independently from plot placement order", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-event-rail-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "2화",
      });
      const firstText = "앞부분 뒤에 첫 원고 사건이 있다.";
      const secondText = "둘째 원고 사건이 먼저 등장한다.";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: firstText.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: firstText }],
      }));
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: second.documentId,
        baseRevisionId: second.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: secondText.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: secondText }],
      }));
      const firstQuote = "첫 원고 사건";
      const secondQuote = "둘째 원고 사건";
      const firstEvent = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: first.workId,
        documentId: first.documentId,
        selection: {
          anchor: firstText.indexOf(firstQuote),
          head: firstText.indexOf(firstQuote) + firstQuote.length,
        },
        exactQuote: firstQuote,
        title: "첫 사건",
        note: "",
      });
      const secondEvent = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: first.workId,
        documentId: second.documentId,
        selection: {
          anchor: secondText.indexOf(secondQuote),
          head: secondText.indexOf(secondQuote) + secondQuote.length,
        },
        exactQuote: secondQuote,
        title: "둘째 사건",
        note: "",
      });
      const planned = await runtime.createAnchorlessEvent({
        schemaVersion: 1,
        workId: first.workId,
        title: "원고 미연결 사건",
        note: "",
      });
      await runtime.createPlotFromEvent({
        schemaVersion: 1,
        workId: first.workId,
        eventBlockId: secondEvent.eventBlockId,
      });
      await runtime.createPlotFromEvent({
        schemaVersion: 1,
        workId: first.workId,
        eventBlockId: firstEvent.eventBlockId,
      });

      let rail = await runtime.listEventRail({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(rail.documents.map((document) => document.title)).toEqual([
        "1화",
        "2화",
      ]);
      expect(rail.manuscriptEvents.map(
        (event) => event.eventBlock.eventBlockId,
      )).toEqual([firstEvent.eventBlockId, secondEvent.eventBlockId]);
      expect(rail.manuscriptEvents.map(
        (event) => event.primaryLocation?.coordinate,
      )).toEqual([
        { documentIndex: 0, offset: firstText.indexOf(firstQuote) },
        { documentIndex: 1, offset: secondText.indexOf(secondQuote) },
      ]);
      expect(rail.plotCards.map(
        (card) => card.events[0]?.eventBlock.eventBlockId,
      )).toEqual([secondEvent.eventBlockId, firstEvent.eventBlockId]);
      expect(rail.unplottedEvents.map(
        (event) => event.eventBlock.eventBlockId,
      )).toEqual([planned.eventBlockId]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      rail = await runtime.listEventRail({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(rail.plotCards.map(
        (card) => card.events[0]?.eventBlock.eventBlockId,
      )).toEqual([secondEvent.eventBlockId, firstEvent.eventBlockId]);
      expect(rail.manuscriptEvents[0]?.primaryLocation?.exactQuote).toBe(
        firstQuote,
      );
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("rebalances a default plot lane only when the configured key length boundary is reached", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-board-rebalance-"),
    );
    const baseOptions = createOptions(rootDirectoryPath);
    const options = {
      ...baseOptions,
      defaults: {
        ...baseOptions.defaults,
        plotBoard: {
          ...baseOptions.defaults.plotBoard,
          orderKeyLengthLimit: 2,
        },
      },
    };
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const plots = [];
      for (const title of ["첫 플롯", "둘째 플롯", "셋째 플롯"]) {
        plots.push(await runtime.createPlotThread({
          schemaVersion: 1,
          workId: created.workId,
          title,
          stage: "",
          summary: "",
          note: "",
        }));
      }
      const before = await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      });
      const lane = before.lanes[0]!;
      const [first, second, third] = lane.placements;
      const after = await runtime.movePlotPlacement({
        schemaVersion: 1,
        workId: created.workId,
        plotPlacementId: third!.plotPlacementId,
        targetBoardId: before.plotBoardId,
        targetLaneId: lane.plotLaneId,
        beforePlacementId: first!.plotPlacementId,
        afterPlacementId: second!.plotPlacementId,
        expectedPlacementRevision: third!.revision,
        expectedBoardRevision: before.revision,
      });

      expect(after.lanes[0]!.placements.map((placement) => placement.plotBeatId))
        .toEqual([
          plots[0]!.plotThreadId,
          plots[2]!.plotThreadId,
          plots[1]!.plotThreadId,
        ]);
      expect(after.lanes[0]!.placements.map((placement) => placement.orderKey))
        .toEqual(["0/1", "1/1", "2/1"]);
      expect(after.lanes[0]!.placements.map((placement) => placement.revision))
        .toEqual([2, 2, 2]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.getDefaultPlotBoard({
        schemaVersion: 1,
        workId: created.workId,
      })).lanes[0]!.placements.map((placement) => placement.plotBeatId))
        .toEqual([
          plots[0]!.plotThreadId,
          plots[2]!.plotThreadId,
          plots[1]!.plotThreadId,
        ]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("replaces one exact Work-owned plot source and resolves it after restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-plot-source-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "첫 문서",
      });
      const secondWork = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "다른 작품 문서",
      });
      const secondDocument = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "둘째 문서",
      });
      const plot = await runtime.createPlotThread({
        schemaVersion: 1,
        workId: first.workId,
        title: "사라진 기록",
        stage: "",
        summary: "",
        note: "",
      });
      const firstText = "앞 문장\n첫 번째 플롯 근거\n뒤 문장";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: firstText.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: firstText }],
      }));
      const secondText = "새 앞 문장\n교체할 정확한 근거\n새 뒤 문장";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: secondDocument.documentId,
        baseRevisionId: secondDocument.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: secondText.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: secondText }],
      }));
      const firstExactText = "첫 번째 플롯 근거";
      const firstFrom = firstText.indexOf(firstExactText);
      const firstSource = await runtime.linkPlotThreadSource({
        schemaVersion: 1,
        workId: first.workId,
        plotThreadId: plot.plotThreadId,
        expectedSourceId: null,
        documentId: first.documentId,
        selection: {
          anchor: firstFrom + firstExactText.length,
          head: firstFrom,
        },
        exactText: firstExactText,
      });

      expect(firstSource).toMatchObject({
        revision: 1,
        workId: first.workId,
        plotThreadId: plot.plotThreadId,
        sourceDocumentId: first.documentId,
        exactText: firstExactText,
        integrity: "resolved",
        range: {
          from: firstFrom,
          to: firstFrom + firstExactText.length,
        },
      });
      await expect(runtime.listPlotThreadSources({
        schemaVersion: 1,
        workId: secondWork.workId,
      })).resolves.toMatchObject({ sources: [] });
      await expect(runtime.linkPlotThreadSource({
        schemaVersion: 1,
        workId: secondWork.workId,
        plotThreadId: plot.plotThreadId,
        expectedSourceId: null,
        documentId: secondWork.documentId,
        selection: { anchor: 0, head: 1 },
        exactText: "다",
      })).rejects.toThrow("Work/plot boundary violation");
      await expect(runtime.linkPlotThreadSource({
        schemaVersion: 1,
        workId: first.workId,
        plotThreadId: plot.plotThreadId,
        expectedSourceId: null,
        documentId: first.documentId,
        selection: { anchor: firstFrom, head: firstFrom + firstExactText.length },
        exactText: firstExactText,
      })).rejects.toThrow("Plot source revision conflict");

      const secondExactText = "교체할 정확한 근거";
      const secondFrom = secondText.indexOf(secondExactText);
      const replacement = await runtime.linkPlotThreadSource({
        schemaVersion: 1,
        workId: first.workId,
        plotThreadId: plot.plotThreadId,
        expectedSourceId: firstSource.sourceId,
        documentId: secondDocument.documentId,
        selection: { anchor: secondFrom, head: secondFrom + secondExactText.length },
        exactText: secondExactText,
      });
      expect(replacement).toMatchObject({
        sourceDocumentId: secondDocument.documentId,
        exactText: secondExactText,
        integrity: "resolved",
        range: { from: secondFrom, to: secondFrom + secondExactText.length },
      });
      expect((await runtime.listPlotThreadSources({
        schemaVersion: 1,
        workId: first.workId,
      })).sources).toEqual([replacement]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.listPlotThreadSources({
        schemaVersion: 1,
        workId: first.workId,
      })).sources).toEqual([
        expect.objectContaining({
          sourceId: replacement.sourceId,
          sourceDocumentId: secondDocument.documentId,
          exactText: secondExactText,
          integrity: "resolved",
          range: { from: secondFrom, to: secondFrom + secondExactText.length },
        }),
      ]);

      const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
      const database = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        const rows = database.prepare(`
          SELECT id, retired_at AS "retiredAt"
          FROM plot_thread_sources
          WHERE work_id = ? AND plot_thread_id = ?
          ORDER BY created_at ASC, id ASC
        `).all(first.workId, plot.plotThreadId);
        expect(rows).toHaveLength(2);
        expect(rows).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: firstSource.sourceId }),
          expect.objectContaining({ id: replacement.sourceId, retiredAt: null }),
        ]));
        expect(rows.find((row) => row.id === firstSource.sourceId))
          .toMatchObject({ retiredAt: expect.any(String) });
      } finally {
        database.close();
      }
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("captures exact Work-owned foreshadow points and resolves their Anchors after restart", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-foreshadow-point-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const line = await runtime.createForeshadowLine({
        schemaVersion: 1,
        workId: first.workId,
        title: "종소리의 정체",
        note: "",
      });
      const manuscript = "앞 문장\n  종소리가 세 번 울렸다.  \n뒤 문장";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: first.workId,
        documentId: first.documentId,
        baseRevisionId: first.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      const exactText = "  종소리가 세 번 울렸다.  \n";
      const from = manuscript.indexOf(exactText);
      const to = from + exactText.length;
      const plant = await runtime.createForeshadowPoint({
        schemaVersion: 1,
        workId: first.workId,
        lineId: line.lineId,
        documentId: first.documentId,
        selection: { anchor: to, head: from },
        exactText,
        roleId: options.foreshadowPointProfile.defaultRoleId,
        note: "첫 단서",
      });

      expect(plant).toMatchObject({
        revision: 1,
        workId: first.workId,
        lineId: line.lineId,
        sourceDocumentId: first.documentId,
        roleId: options.foreshadowPointProfile.defaultRoleId,
        note: "첫 단서",
        exactText,
        integrity: "resolved",
        range: { from, to },
      });
      await expect(runtime.createForeshadowPoint({
        schemaVersion: 1,
        workId: second.workId,
        lineId: line.lineId,
        documentId: second.documentId,
        selection: { anchor: 1, head: 0 },
        exactText: "다",
        roleId: options.foreshadowPointProfile.defaultRoleId,
        note: "",
      })).rejects.toThrow("Work/foreshadow line boundary violation");
      await expect(runtime.createForeshadowPoint({
        schemaVersion: 1,
        workId: first.workId,
        lineId: line.lineId,
        documentId: first.documentId,
        selection: { anchor: to, head: from },
        exactText,
        roleId: randomUUID(),
        note: "",
      })).rejects.toThrow("Unknown foreshadow point role");

      const payoff = await runtime.createForeshadowPoint({
        schemaVersion: 1,
        workId: first.workId,
        lineId: line.lineId,
        documentId: first.documentId,
        selection: { anchor: from, head: to },
        exactText,
        roleId: options.foreshadowPointProfile.payoffRoleId,
        note: "회수",
      });
      expect((await runtime.listForeshadowPoints({
        schemaVersion: 1,
        workId: first.workId,
      })).points.map((point) => point.pointId)).toEqual([
        plant.pointId,
        payoff.pointId,
      ]);
      await expect(runtime.listForeshadowPoints({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({ points: [] });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listForeshadowPoints({
        schemaVersion: 1,
        workId: first.workId,
      });
      expect(reopened.points).toHaveLength(2);
      expect(reopened.points).toEqual(expect.arrayContaining([
        expect.objectContaining({
          pointId: plant.pointId,
          exactText,
          integrity: "resolved",
          range: { from, to },
        }),
        expect.objectContaining({
          pointId: payoff.pointId,
          roleId: options.foreshadowPointProfile.payoffRoleId,
        }),
      ]));
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("stores a cursor boundary as a SceneOverride without changing manuscript text", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-scene-override-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const manuscript = "도입과 다음 장면 사이";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
        }),
      );
      const offset = manuscript.indexOf("다음");
      const createdOverride = await runtime.createSceneOverride({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: offset, head: offset },
        exactQuote: "",
        operation: "add",
        note: "두 장면 사이",
      });

      expect(createdOverride).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        operation: "add",
        note: "두 장면 사이",
        boundaries: [
          {
            exactQuote: "",
            integrity: "resolved",
            range: { from: offset, to: offset },
          },
        ],
      });
      expect(createdOverride.baseRuleSetRevision).toBeGreaterThan(0);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listSceneOverrides({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.sceneOverrides).toHaveLength(1);
      expect(reopened.sceneOverrides[0]).toMatchObject({
        sceneOverrideId: createdOverride.sceneOverrideId,
        documentId: created.documentId,
        operation: "add",
        boundaries: [{ range: { from: offset, to: offset } }],
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents[0]?.initialText,
      ).toBe(manuscript);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists the final scene projection, override fold, and manual event exceptions across reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-scene-projection-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "첫 회차",
      });
      const manuscript = "첫 사건\n***\n둘째 사건";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      const createEvent = (exactQuote: string, title: string) => {
        const from = manuscript.indexOf(exactQuote);
        return runtime.createEventBlock({
          schemaVersion: 1,
          workId: created.workId,
          documentId: created.documentId,
          selection: { anchor: from, head: from + exactQuote.length },
          exactQuote,
          title,
          note: "",
        });
      };
      const firstEvent = await createEvent("첫 사건", "첫 사건");
      const secondEvent = await createEvent("둘째 사건", "둘째 사건");
      const planned = await runtime.createAnchorlessEvent({
        schemaVersion: 1,
        workId: created.workId,
        title: "예정 사건",
        note: "",
      });

      const initial = await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(initial.status).toBe("clean");
      expect(initial.scenes).toHaveLength(2);
      expect(initial.scenes[0]?.events).toMatchObject([
        { eventBlockId: firstEvent.eventBlockId, membership: "automatic" },
      ]);
      expect(initial.scenes[1]?.events).toMatchObject([
        { eventBlockId: secondEvent.eventBlockId, membership: "automatic" },
      ]);

      const separatorFrom = manuscript.indexOf("***");
      await runtime.createSceneOverride({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: {
          anchor: separatorFrom,
          head: separatorFrom + "***\n".length,
        },
        exactQuote: "***\n",
        operation: "merge",
        note: "앞 장면과 병합",
      });
      expect((await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      })).scenes).toHaveLength(1);

      await runtime.createSceneOverride({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: separatorFrom, head: separatorFrom },
        exactQuote: "",
        operation: "split",
        note: "다시 분할",
      });
      let projection = await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(projection.scenes).toHaveLength(2);
      const firstScene = projection.scenes[0]!;
      const secondScene = projection.scenes[1]!;

      projection = await runtime.setSceneEventOverride({
        schemaVersion: 1,
        workId: created.workId,
        sceneKey: firstScene.sceneKey,
        eventBlockId: firstEvent.eventBlockId,
        operation: "exclude",
        expectedRevision: null,
      });
      projection = await runtime.setSceneEventOverride({
        schemaVersion: 1,
        workId: created.workId,
        sceneKey: secondScene.sceneKey,
        eventBlockId: planned.eventBlockId,
        operation: "include",
        expectedRevision: null,
      });
      expect(projection.scenes[0]?.events).toEqual([]);
      expect(projection.scenes[0]?.excludedEvents).toMatchObject([
        { eventBlockId: firstEvent.eventBlockId },
      ]);
      expect(projection.scenes[1]?.events).toMatchObject([
        { eventBlockId: secondEvent.eventBlockId, membership: "automatic" },
        { eventBlockId: planned.eventBlockId, membership: "manual" },
      ]);
      expect(projection.unassignedEvents).toMatchObject([
        { eventBlockId: firstEvent.eventBlockId },
      ]);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.scenes.map((scene) => scene.sceneKey)).toEqual(
        projection.scenes.map((scene) => scene.sceneKey),
      );
      expect(reopened.sceneEventOverrides).toHaveLength(2);
      expect(reopened.scenes[0]?.excludedEvents).toMatchObject([
        { eventBlockId: firstEvent.eventBlockId },
      ]);
      expect(reopened.scenes[1]?.events).toEqual(projection.scenes[1]?.events);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("recomputes scenes from a revised Work SceneRuleSet and preserves it across reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-scene-rule-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "규칙 회차",
      });
      const manuscript = "하나\n---\n둘";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      const initial = await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(initial.scenes).toHaveLength(1);

      const revised = await runtime.updateSceneRuleSet({
        schemaVersion: 1,
        workId: created.workId,
        sceneRuleSetId: initial.ruleSet.sceneRuleSetId,
        expectedRevision: initial.ruleSet.revision,
        displayName: "대시 구분 규칙",
        boundaryRules: [
          {
            boundaryRuleId: "dash-divider",
            kind: "line-regexp",
            pattern: "^\\s*---\\s*$",
            flags: "u",
          },
        ],
        normalizationPolicy: "preserve",
        enabled: true,
      });
      expect(revised.ruleSet).toMatchObject({
        revision: initial.ruleSet.revision + 1,
        displayName: "대시 구분 규칙",
      });
      expect(revised.scenes).toHaveLength(2);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened.ruleSet).toEqual(revised.ruleSet);
      expect(reopened.scenes.map((scene) => scene.range)).toEqual(
        revised.scenes.map((scene) => scene.range),
      );
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("migrates schema 4 scene inputs without changing EventBlock or SceneOverride content", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-scene-projection-migration-"),
    );
    const options = createOptions(rootDirectoryPath);
    const profiles = createLocalWorkspaceStorageProfiles(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: "이주 회차",
      });
      const manuscript = "첫 장면\n***\n둘째 장면";
      await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      const event = await runtime.createEventBlock({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: 0, head: "첫 장면".length },
        exactQuote: "첫 장면",
        title: "보존 사건",
        note: "schema 4 입력",
      });
      const splitOffset = manuscript.indexOf("둘째") + 2;
      const sceneOverride = await runtime.createSceneOverride({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        selection: { anchor: splitOffset, head: splitOffset },
        exactQuote: "",
        operation: "split",
        note: "보존할 수동 분할",
      });
      runtime.close();

      const versionFour = new DatabaseSync(profiles.databasePath);
      try {
        versionFour.exec("PRAGMA foreign_keys = OFF");
        versionFour.exec(`
          BEGIN IMMEDIATE;
          DROP TABLE scene_event_overrides;
          DROP TABLE scene_rule_sets;
          UPDATE storage_ledger_identity
          SET target_schema_version = 4;
          PRAGMA user_version = 4;
          COMMIT;
        `);
      } finally {
        versionFour.close();
      }

      runtime = await openLocalWorkspaceRuntime(options);
      const migratedEvents = await runtime.listEventBlocks({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(migratedEvents.eventBlocks).toContainEqual(event);
      const migratedOverrides = await runtime.listSceneOverrides({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(migratedOverrides.sceneOverrides).toContainEqual(sceneOverride);
      const migratedProjection = await runtime.listSceneProjection({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(migratedProjection).toMatchObject({
        status: "clean",
        ruleSet: {
          revision: sceneOverride.baseRuleSetRevision,
          boundaryRules: options.defaults.sceneRuleSet.boundaryRules,
        },
      });
      expect(migratedProjection.scenes).toHaveLength(3);
      expect(migratedProjection.scenes[0]?.events).toMatchObject([
        { eventBlockId: event.eventBlockId, membership: "automatic" },
      ]);
      runtime.close();

      const audit = new DatabaseSync(profiles.databasePath, { readOnly: true });
      try {
        expect(audit.prepare("PRAGMA user_version").get()).toEqual({
          user_version: 5,
        });
        expect(audit.prepare(`
          SELECT target_schema_version AS "targetSchemaVersion"
          FROM storage_ledger_identity
        `).get()).toEqual({ targetSchemaVersion: 5 });
        expect(audit.prepare(`
          SELECT migration_id AS "migrationId"
          FROM migration_receipts
          WHERE migration_id = 'local-workspace-scene-projection-v4-to-v5'
        `).get()).toEqual({
          migrationId: "local-workspace-scene-projection-v4-to-v5",
        });
        expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      } finally {
        audit.close();
      }
      runtime = await openLocalWorkspaceRuntime(options);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists a manual writing session and caller-configured focus cycle across reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-activity-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const started = await runtime.startWritingSession({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        note: "직접 시작",
      });
      expect(started.activeSessionId).not.toBeNull();
      expect(started.sessions[0]).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        state: "active",
        note: "직접 시작",
      });

      const manuscript = "기록 세션 중 작성한 원고";
      await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
        }),
      );
      const targetDurationMs = 37 * 60 * 1_000;
      const focused = await runtime.startFocusCycle({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        phaseRef: "초고 집중",
        targetDurationMs,
        note: "사용자 지정 시간",
      });
      const activeFocusCycleId = focused.activeFocusCycleId;
      expect(activeFocusCycleId).not.toBeNull();
      expect(focused.focusCycles[0]).toMatchObject({
        sessionId: started.activeSessionId,
        state: "running",
        phaseRef: "초고 집중",
        targetDurationMs,
        note: "사용자 지정 시간",
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listWorkActivity({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopened).toMatchObject({
        activeSessionId: started.activeSessionId,
        activeFocusCycleId,
      });
      expect(reopened.focusCycles[0]?.targetDurationMs).toBe(targetDurationMs);

      if (activeFocusCycleId === null || started.activeSessionId === null) {
        throw new Error("Expected active activity identities");
      }
      const stoppedFocus = await runtime.stopFocusCycle({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: activeFocusCycleId,
      });
      expect(stoppedFocus.activeFocusCycleId).toBeNull();
      expect(stoppedFocus.focusCycles[0]).toMatchObject({ state: "stopped" });

      const stoppedSession = await runtime.stopWritingSession({
        schemaVersion: 1,
        workId: created.workId,
        sessionId: started.activeSessionId,
      });
      expect(stoppedSession.activeSessionId).toBeNull();
      expect(stoppedSession.sessions[0]).toMatchObject({
        state: "completed",
        characterDelta: manuscript.length,
      });
      expect(stoppedSession.sessions[0]?.activeDurationMs).toBeGreaterThanOrEqual(0);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const completed = await runtime.listWorkActivity({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(completed.sessions[0]).toMatchObject({
        state: "completed",
        characterDelta: manuscript.length,
      });
      expect(completed.focusCycles[0]).toMatchObject({
        state: "stopped",
        targetDurationMs,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("runs one Work-owned Pomodoro through pause, restore, work-break deadlines, and completion", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-pomodoro-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      expect(
        await runtime.getPomodoro({
          schemaVersion: 1,
          workId: created.workId,
        }),
      ).toMatchObject({
        workId: created.workId,
        settings: null,
        status: "unconfigured",
        completedWorkCycles: 0,
        activePhase: null,
      });

      const workDurationMs = 160;
      const breakDurationMs = 140;
      const workCycleCount = 2;
      const started = await runtime.configureAndStartPomodoro({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        workDurationMs,
        breakDurationMs,
        workCycleCount,
        autoAdvance: false,
        note: "두 주기",
      });
      expect(started).toMatchObject({
        settings: {
          workDurationMs,
          breakDurationMs,
          workCycleCount,
          autoAdvance: false,
        },
        status: "running",
        completedWorkCycles: 0,
        activePhase: {
          phase: "work",
          cycleNumber: 1,
          targetDurationMs: workDurationMs,
          state: "running",
          note: "두 주기",
        },
      });
      const firstCycleId = started.activePhase?.focusCycleId;
      if (firstCycleId === undefined) throw new Error("Expected first Pomodoro phase");

      const paused = await runtime.pausePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: firstCycleId,
      });
      expect(paused).toMatchObject({
        status: "paused",
        activePhase: {
          focusCycleId: firstCycleId,
          pauseReason: "manual",
          deadlineAt: null,
        },
      });
      expect(paused.activePhase?.remainingDurationMs).toBeGreaterThan(0);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopenedManualPause = await runtime.getPomodoro({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(reopenedManualPause).toMatchObject({
        status: "paused",
        activePhase: { pauseReason: "manual" },
      });

      const resumedWork = await runtime.resumePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: firstCycleId,
      });
      expect(resumedWork).toMatchObject({
        status: "running",
        activePhase: { deadlineAt: expect.any(String), pauseReason: null },
      });
      await new Promise((resolve) =>
        setTimeout(resolve, (resumedWork.activePhase?.remainingDurationMs ?? 0) + 40),
      );
      const breakPaused = await runtime.reconcilePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: firstCycleId,
      });
      expect(breakPaused).toMatchObject({
        status: "paused",
        completedWorkCycles: 1,
        activePhase: {
          phase: "break",
          cycleNumber: 1,
          targetDurationMs: breakDurationMs,
          remainingDurationMs: breakDurationMs,
          pauseReason: "phase-complete",
        },
      });
      const breakCycleId = breakPaused.activePhase?.focusCycleId;
      if (breakCycleId === undefined) throw new Error("Expected break phase");

      const resumedBreak = await runtime.resumePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: breakCycleId,
      });
      expect(resumedBreak.status).toBe("running");
      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const restoredBreak = await runtime.getPomodoro({
        schemaVersion: 1,
        workId: created.workId,
      });
      expect(restoredBreak).toMatchObject({
        status: "paused",
        activePhase: {
          focusCycleId: breakCycleId,
          phase: "break",
          pauseReason: "restore",
          deadlineAt: null,
        },
      });

      const breakAgain = await runtime.resumePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: breakCycleId,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, (breakAgain.activePhase?.remainingDurationMs ?? 0) + 40),
      );
      const secondWorkPaused = await runtime.reconcilePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: breakCycleId,
      });
      expect(secondWorkPaused).toMatchObject({
        status: "paused",
        completedWorkCycles: 1,
        activePhase: {
          phase: "work",
          cycleNumber: 2,
          pauseReason: "phase-complete",
        },
      });
      const secondWorkCycleId = secondWorkPaused.activePhase?.focusCycleId;
      if (secondWorkCycleId === undefined) throw new Error("Expected second work phase");
      const finalWork = await runtime.resumePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: secondWorkCycleId,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, (finalWork.activePhase?.remainingDurationMs ?? 0) + 40),
      );
      const completed = await runtime.reconcilePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: secondWorkCycleId,
      });
      expect(completed).toMatchObject({
        status: "completed",
        completedWorkCycles: workCycleCount,
        activePhase: null,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(
        await runtime.getPomodoro({ schemaVersion: 1, workId: created.workId }),
      ).toMatchObject({
        status: "completed",
        settings: { workDurationMs, breakDurationMs, workCycleCount },
      });

      const autoWorkDurationMs = 90;
      const autoBreakDurationMs = 80;
      const autoStarted = await runtime.configureAndStartPomodoro({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        workDurationMs: autoWorkDurationMs,
        breakDurationMs: autoBreakDurationMs,
        workCycleCount: 2,
        autoAdvance: true,
        note: "자동 전환",
      });
      const autoWorkCycleId = autoStarted.activePhase?.focusCycleId;
      if (autoWorkCycleId === undefined) {
        throw new Error("Expected auto-advance work phase");
      }
      await new Promise((resolve) =>
        setTimeout(resolve, autoWorkDurationMs + 40),
      );
      const autoBreak = await runtime.reconcilePomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: autoWorkCycleId,
      });
      expect(autoBreak).toMatchObject({
        status: "running",
        completedWorkCycles: 1,
        activePhase: {
          phase: "break",
          cycleNumber: 1,
          targetDurationMs: autoBreakDurationMs,
          pauseReason: null,
        },
      });
      expect(
        await runtime.listWorkActivity({
          schemaVersion: 1,
          workId: created.workId,
        }),
      ).toMatchObject({
        activeFocusCycleId: autoBreak.activePhase?.focusCycleId,
        focusCycles: expect.arrayContaining([
          expect.objectContaining({
            focusCycleId: autoBreak.activePhase?.focusCycleId,
            phaseRef: "break",
          }),
        ]),
      });
      if (autoBreak.activePhase === null) {
        throw new Error("Expected auto-advance break phase");
      }
      await runtime.stopPomodoro({
        schemaVersion: 1,
        workId: created.workId,
        focusCycleId: autoBreak.activePhase.focusCycleId,
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("restores a Document by appending a revision and keeps an immutable WorkSnapshot", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-version-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const firstText = `첫 원고 ${randomUUID()}`;
      const firstReceipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: firstText.length,
          changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: firstText }],
        }),
      );
      if (!("revisionId" in firstReceipt)) {
        throw new Error("Expected a durable revision receipt");
      }
      const snapshotLabel = `원고 기준 ${randomUUID()}`;
      const snapshot = await runtime.createWorkSnapshot({
        schemaVersion: 1,
        workId: created.workId,
        label: snapshotLabel,
      });
      expect(snapshot).toMatchObject({
        workId: created.workId,
        label: snapshotLabel,
        documentRevisions: [
          {
            documentId: created.documentId,
            documentRevisionId: firstReceipt.revisionId,
          },
        ],
      });

      const suffix = `\n둘째 원고 ${randomUUID()}`;
      const secondReceipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 1,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: firstText.length,
          afterTextLengthUtf16: firstText.length + suffix.length,
          changes: [
            {
              fromUtf16: firstText.length,
              toUtf16: firstText.length,
              insertedText: suffix,
            },
          ],
        }),
      );
      if (!("revisionId" in secondReceipt)) {
        throw new Error("Expected a durable revision receipt");
      }
      const changedComparison = await runtime.compareWorkSnapshot({
        schemaVersion: 1,
        workId: created.workId,
        workSnapshotId: snapshot.workSnapshotId,
      });
      expect(changedComparison.documents).toEqual([
        expect.objectContaining({
          documentId: created.documentId,
          status: "changed",
          snapshotRevisionId: firstReceipt.revisionId,
          currentRevisionId: secondReceipt.revisionId,
          snapshotLength: firstText.length,
          currentLength: firstText.length + suffix.length,
          characterDelta: suffix.length,
        }),
      ]);
      expect(JSON.stringify(changedComparison)).not.toContain(firstText);
      expect(JSON.stringify(changedComparison)).not.toContain(suffix);
      const beforeRestore = await runtime.listDocumentRevisions({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
      });
      expect(beforeRestore.revisions).toHaveLength(3);
      expect(
        beforeRestore.revisions.find((revision) => revision.isCurrent),
      ).toMatchObject({ revisionId: secondReceipt.revisionId });

      const restored = await runtime.restoreDocumentRevision({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
        targetRevisionId: firstReceipt.revisionId,
      });
      expect(restored).toMatchObject({
        targetRevisionId: firstReceipt.revisionId,
      });
      expect(restored.restoredRevisionId).not.toBe(firstReceipt.revisionId);
      expect(
        runtime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        documentRevisionId: restored.restoredRevisionId,
        initialText: firstText,
      });
      const afterRestore = await runtime.listDocumentRevisions({
        schemaVersion: 1,
        workId: created.workId,
        documentId: created.documentId,
      });
      expect(afterRestore.revisions).toHaveLength(4);
      expect(
        afterRestore.revisions.find((revision) => revision.isCurrent),
      ).toMatchObject({ revisionId: restored.restoredRevisionId });
      expect(afterRestore.revisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ revisionId: firstReceipt.revisionId }),
          expect.objectContaining({ revisionId: secondReceipt.revisionId }),
        ]),
      );
      await expect(
        runtime.compareWorkSnapshot({
          schemaVersion: 1,
          workId: created.workId,
          workSnapshotId: snapshot.workSnapshotId,
        }),
      ).resolves.toMatchObject({
        totals: {
          unchangedCount: 1,
          changedCount: 0,
          characterDelta: 0,
        },
        documents: [
          {
            documentId: created.documentId,
            status: "unchanged",
            snapshotRevisionId: firstReceipt.revisionId,
            currentRevisionId: restored.restoredRevisionId,
            snapshotLength: firstText.length,
            currentLength: firstText.length,
            characterDelta: 0,
            title: expect.any(String),
          },
        ],
      });
      expect(
        (await runtime.listWorkSnapshots({
          schemaVersion: 1,
          workId: created.workId,
        })).snapshots[0],
      ).toEqual(snapshot);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(
        runtime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        documentRevisionId: restored.restoredRevisionId,
        initialText: firstText,
      });
      expect(
        (await runtime.listWorkSnapshots({
          schemaVersion: 1,
          workId: created.workId,
        })).snapshots[0],
      ).toEqual(snapshot);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned tasks, daily routines, D-DAY values, and exact completions across reopen", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-work-schedule-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);

    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "일정 작품",
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: "다른 작품",
        firstDocumentTitle: "1화",
      });
      const task = await runtime.createWorkScheduleItem({
        schemaVersion: 1,
        workId: first.workId,
        item: {
          kind: "task",
          label: "원고 검토",
          date: "2026-08-11",
          time: "09:30",
        },
      });
      const routine = await runtime.createWorkScheduleItem({
        schemaVersion: 1,
        workId: first.workId,
        item: {
          kind: "routine",
          label: "매일 집필",
          startDate: "2026-08-10",
          time: null,
        },
      });
      const dday = await runtime.createWorkScheduleItem({
        schemaVersion: 1,
        workId: first.workId,
        item: {
          kind: "dday",
          label: "공모 마감",
          date: "2026-08-20",
          time: "18:00",
          workload: {
            mode: "episodeCount",
            targetEpisodeCount: 37,
            baselineCompletedCount: 12,
          },
        },
      });

      const completedTask = await runtime.setWorkScheduleCompletion({
        schemaVersion: 1,
        workId: first.workId,
        itemId: task.itemId,
        expectedRevision: task.revision,
        date: "2026-08-11",
        completed: true,
      });
      if (completedTask.kind !== "task") {
        throw new Error("Expected a completed schedule task");
      }
      await runtime.setWorkScheduleCompletion({
        schemaVersion: 1,
        workId: first.workId,
        itemId: routine.itemId,
        expectedRevision: routine.revision,
        date: "2026-08-11",
        completed: true,
      });
      const renamedDday = await runtime.updateWorkScheduleItem({
        schemaVersion: 1,
        workId: first.workId,
        itemId: dday.itemId,
        expectedRevision: dday.revision,
        item: {
          kind: "dday",
          label: "장편 공모 마감",
          date: "2026-08-21",
          time: "18:00",
          workload: {
            mode: "episodeCount",
            targetEpisodeCount: 37,
            baselineCompletedCount: 12,
          },
        },
      });

      await expect(
        runtime.updateWorkScheduleItem({
          schemaVersion: 1,
          workId: first.workId,
          itemId: dday.itemId,
          expectedRevision: dday.revision,
          item: {
            kind: "dday",
            label: "오래된 변경",
            date: "2026-08-22",
            time: null,
            workload: { mode: "none" },
          },
        }),
      ).rejects.toThrow("revision conflict");
      await expect(
        runtime.setWorkScheduleCompletion({
          schemaVersion: 1,
          workId: second.workId,
          itemId: routine.itemId,
          expectedRevision: routine.revision,
          date: "2026-08-11",
          completed: true,
        }),
      ).rejects.toThrow("Work schedule item");

      const beforeReopen = await runtime.listWorkSchedule({
        schemaVersion: 1,
        workId: first.workId,
        range: { from: "2026-08-10", to: "2026-08-12" },
      });
      expect(beforeReopen.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemId: task.itemId,
            completedAt: completedTask.completedAt,
          }),
          expect.objectContaining({
            itemId: renamedDday.itemId,
            label: "장편 공모 마감",
            date: "2026-08-21",
          }),
        ]),
      );
      expect(beforeReopen.occurrences).toHaveLength(4);
      expect(
        beforeReopen.occurrences.find(
          (occurrence) =>
            occurrence.itemId === routine.itemId &&
            occurrence.date === "2026-08-11",
        ),
      ).toMatchObject({ completed: true });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopened = await runtime.listWorkSchedule({
        schemaVersion: 1,
        workId: first.workId,
        range: { from: "2026-08-10", to: "2026-08-12" },
      });
      expect(reopened).toEqual(beforeReopen);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("retires only the explicitly selected Work schedule item", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-retire-schedule-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    const runtime = await openLocalWorkspaceRuntime(options);
    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "일정 정리 작품",
        firstDocumentTitle: "1화",
      });
      const first = await runtime.createWorkScheduleItem({
        schemaVersion: 1,
        workId: created.workId,
        item: {
          kind: "task",
          label: "삭제 대상",
          date: "2026-08-10",
          time: null,
        },
      });
      const preserved = await runtime.createWorkScheduleItem({
        schemaVersion: 1,
        workId: created.workId,
        item: {
          kind: "task",
          label: "보존 대상",
          date: "2026-08-10",
          time: null,
        },
      });
      await runtime.retireWorkScheduleItem({
        schemaVersion: 1,
        workId: created.workId,
        itemId: first.itemId,
        expectedRevision: first.revision,
      });
      const projection = await runtime.listWorkSchedule({
        schemaVersion: 1,
        workId: created.workId,
        range: { from: "2026-08-10", to: "2026-08-10" },
      });
      expect(projection.items.map((item) => item.itemId)).toEqual([
        preserved.itemId,
      ]);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists the runtime-profile app setting and re-derives exact Work episode progress", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-app-settings-runtime-"),
    );
    const options = {
      ...createOptions(rootDirectoryPath),
      appSettingsProfile: parseAppSettingsProfile({
        schemaVersion: 1,
        defaultEpisodeCharacters: {
          defaultValue: 3,
          minValue: 1,
          maxValue: 10,
        },
      }),
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "회차 진척 작품",
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "2화",
      });
      const texts = [
        {
          documentId: first.documentId,
          revisionId: first.revisionId,
          text: "한👨‍👩‍👧‍👦e\u0301",
        },
        {
          documentId: second.documentId,
          revisionId: second.revisionId,
          text: "두글",
        },
      ];
      for (const target of texts) {
        await runtime.saveChangeBatch(
          parseChangeBatch({
            schemaVersion: 1,
            textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
            batchId: randomUUID(),
            workId: first.workId,
            documentId: target.documentId,
            baseRevisionId: target.revisionId,
            sequence: 0,
            createdAt: new Date().toISOString(),
            beforeTextLengthUtf16: 0,
            afterTextLengthUtf16: target.text.length,
            changes: [
              {
                fromUtf16: 0,
                toUtf16: 0,
                insertedText: target.text,
              },
            ],
          }),
        );
      }

      await expect(runtime.getAppSettings()).resolves.toEqual({
        schemaVersion: 1,
        revision: 0,
        settings: { defaultEpisodeCharacters: 3 },
        updatedAt: null,
      });
      const initialSchedule = await runtime.listWorkSchedule({
        schemaVersion: 1,
        workId: first.workId,
        range: { from: "2026-08-10", to: "2026-08-10" },
      });
      expect(initialSchedule.episodeProgress).toEqual({
        defaultEpisodeCharacters: 3,
        totalCharacters: 5,
        totalEpisodeCount: 2,
        completedEpisodeCount: 1,
        completedEpisodeNumbers: [1],
      });

      const saved = await runtime.saveAppSettings({
        schemaVersion: 1,
        expectedRevision: 0,
        settings: { defaultEpisodeCharacters: 2 },
      });
      expect(saved).toMatchObject({
        revision: 1,
        settings: { defaultEpisodeCharacters: 2 },
        updatedAt: expect.any(String),
      });
      await expect(
        runtime.saveAppSettings({
          schemaVersion: 1,
          expectedRevision: 0,
          settings: { defaultEpisodeCharacters: 4 },
        }),
      ).rejects.toThrow("revision conflict");
      await expect(
        runtime.listWorkSchedule({
          schemaVersion: 1,
          workId: first.workId,
          range: { from: "2026-08-10", to: "2026-08-10" },
        }),
      ).resolves.toMatchObject({
        episodeProgress: {
          defaultEpisodeCharacters: 2,
          totalCharacters: 5,
          totalEpisodeCount: 2,
          completedEpisodeCount: 2,
          completedEpisodeNumbers: [1, 2],
        },
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      await expect(runtime.getAppSettings()).resolves.toEqual(saved);
      await expect(
        runtime.listWorkSchedule({
          schemaVersion: 1,
          workId: first.workId,
          range: { from: "2026-08-10", to: "2026-08-10" },
        }),
      ).resolves.toMatchObject({
        episodeProgress: {
          defaultEpisodeCharacters: 2,
          completedEpisodeCount: 2,
        },
      });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists exact per-Work quick memo text, rejects stale writes, and clears only that memo", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-quick-memo-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "메모 작품",
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: "다른 작품",
        firstDocumentTitle: "1화",
      });
      const memoText = "  인물 이름 확인\n다음 장면 전환  ";
      const saved = await runtime.saveWorkQuickMemo({
        schemaVersion: 1,
        workId: first.workId,
        expectedRevision: 0,
        text: memoText,
      });
      expect(saved).toMatchObject({
        workId: first.workId,
        revision: 1,
        text: memoText,
        updatedAt: expect.any(String),
      });
      await expect(
        runtime.saveWorkQuickMemo({
          schemaVersion: 1,
          workId: first.workId,
          expectedRevision: 0,
          text: "오래된 메모",
        }),
      ).rejects.toThrow("revision conflict");
      await expect(
        runtime.getWorkQuickMemo({ schemaVersion: 1, workId: second.workId }),
      ).resolves.toMatchObject({ revision: 0, text: "", updatedAt: null });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      await expect(
        runtime.getWorkQuickMemo({ schemaVersion: 1, workId: first.workId }),
      ).resolves.toEqual(saved);
      await expect(
        runtime.saveWorkQuickMemo({
          schemaVersion: 1,
          workId: first.workId,
          expectedRevision: saved.revision,
          text: "",
        }),
      ).resolves.toMatchObject({ revision: 0, text: "", updatedAt: null });
      await expect(
        runtime.getWorkQuickMemo({ schemaVersion: 1, workId: second.workId }),
      ).resolves.toMatchObject({ revision: 0, text: "", updatedAt: null });
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists Work-owned assistant permissions, exact access receipts, consumption, and revocation", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-assistant-context-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "조수 권한 작품",
        firstDocumentTitle: "1화",
      });
      const manuscript = `정확 문맥 ${randomUUID()}`;
      const saved = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: manuscript,
          }],
        }),
      );
      if (!("revisionId" in saved)) {
        throw new Error("Expected a revision save receipt");
      }
      const conversationId = randomUUID();
      const destinationId = `destination:${randomUUID()}`;
      expect(await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      })).toMatchObject({ grants: [], receipts: [], candidates: [] });

      const grant = await runtime.grantAssistantContextPermission({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
        capability: "vocabulary-lookup",
        destinationId,
        localScope: "selection",
        externalScope: "selection",
        duration: "once",
      });
      const range = {
        documentId: created.documentId,
        documentRevisionId: saved.revisionId,
        from: 1,
        to: manuscript.length,
      };
      const access = await runtime.authorizeAssistantContextAccess({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: created.workId,
        conversationId,
        capability: "vocabulary-lookup",
        destinationId,
        requiredLocalScope: "selection",
        requiredExternalScope: "selection",
        readRanges: [range],
        transmittedRanges: [range],
      });
      expect(access).toMatchObject({
        allowed: true,
        receipt: {
          workId: created.workId,
          readRanges: [range],
          transmittedRanges: [range],
          grantIds: [grant.grantId],
        },
      });
      const beforeReopen = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      });
      expect(beforeReopen.grants[0]).toMatchObject({
        grantId: grant.grantId,
        revision: 2,
      });
      expect(beforeReopen.grants[0]?.consumedAt).not.toBeNull();
      expect(beforeReopen.receipts).toHaveLength(1);
      expect(JSON.stringify(beforeReopen.receipts)).not.toContain(manuscript);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      })).toEqual(beforeReopen);
      const revoked = await runtime.revokeAssistantContextPermission({
        schemaVersion: 1,
        workId: created.workId,
        grantId: grant.grantId,
        expectedRevision: 2,
      });
      expect(revoked).toMatchObject({ revision: 3 });
      expect(revoked.revokedAt).not.toBeNull();
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates and reopens a value-bearing local vocabulary Candidate only after Work context approval", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-vocabulary-candidate-runtime-"),
    );
    const destinationId = `local-search-${randomUUID()}`;
    const options = {
      ...createOptions(rootDirectoryPath),
      assistantDestinationProfile: parseAssistantDestinationProfile({
        schemaVersion: 1,
        destinations: [
          {
            destinationId,
            label: "작품 어휘 검색",
            kind: "local-exact-vocabulary-search",
            capabilities: ["vocabulary-lookup"],
            requiredLocalScope: "work",
            requiredExternalScope: "none",
          },
        ],
      }),
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "어휘 검색 작품",
        firstDocumentTitle: "1화",
      });
      const second = await runtime.createDocument({
        schemaVersion: 1,
        workId: first.workId,
        title: "2화",
      });
      const query = "서늘한";
      const documents = [
        {
          documentId: first.documentId,
          revisionId: first.revisionId,
          text: `${query} 바람, ${query} 밤`,
        },
        {
          documentId: second.documentId,
          revisionId: second.revisionId,
          text: `다시 ${query} 새벽`,
        },
      ];
      let firstCurrentRevisionId: typeof first.revisionId | null = null;
      for (const document of documents) {
        const receipt = await runtime.saveChangeBatch(parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: first.workId,
          documentId: document.documentId,
          baseRevisionId: document.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: document.text.length,
          changes: [{
            fromUtf16: 0,
            toUtf16: 0,
            insertedText: document.text,
          }],
        }));
        if (!("revisionId" in receipt)) {
          throw new Error("Expected a revision save receipt");
        }
        if (document.documentId === first.documentId) {
          firstCurrentRevisionId = receipt.revisionId;
        }
      }
      if (firstCurrentRevisionId === null) {
        throw new Error("First Document revision was not saved");
      }
      const conversationId = randomUUID();
      await runtime.grantAssistantContextPermission({
        schemaVersion: 1,
        workId: first.workId,
        conversationId: null,
        capability: "vocabulary-lookup",
        destinationId,
        localScope: "work",
        externalScope: "none",
        duration: "work",
      });
      const result = await runtime.runAssistantVocabularyLookup({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: first.workId,
        conversationId,
        destinationId,
        sourceRange: {
          documentId: first.documentId,
          documentRevisionId: firstCurrentRevisionId,
          from: 0,
          to: query.length,
        },
      });
      expect(result).toMatchObject({
        status: "candidate",
        candidate: {
          workId: first.workId,
          query,
          occurrences: [
            { documentId: first.documentId, from: 0, to: query.length },
            { documentId: first.documentId },
            { documentId: second.documentId },
          ],
        },
      });
      const state = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: first.workId,
        conversationId,
      });
      expect(state.candidates).toHaveLength(1);
      expect(state.receipts).toHaveLength(1);
      expect(JSON.stringify(state.receipts)).not.toContain(query);
      expect(state.receipts[0]).toMatchObject({
        transmittedCharacterCount: 0,
        readCharacterCount: documents.reduce(
          (total, document) => total + document.text.length,
          0,
        ),
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: first.workId,
        conversationId,
      })).toEqual(state);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("sends only an approved exact selection and reopens the resulting vocabulary suggestion Candidate without changing the manuscript", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-vocabulary-suggestion-runtime-"),
    );
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const connectorReceiptId = entityId<"ConnectorReceipt">(randomUUID());
    const connectorCalls: Array<Readonly<{
      requestId: string;
      connectionId: string;
      query: string;
      context: string | null;
    }>> = [];
    const options = {
      ...createOptions(rootDirectoryPath),
      executeAssistantVocabularySuggestion: async (input: Readonly<{
        requestId: string;
        connectionId: string;
        query: string;
        context: string | null;
      }>) => {
        connectorCalls.push(input);
        return {
          receipt: {
            schemaVersion: 1 as const,
            receiptId: connectorReceiptId,
            requestId: entityId<"AssistantConnectorRequest">(input.requestId),
            connectionId,
            connectorKind: "test-structured-json",
            operation: "vocabulary-suggestions" as const,
            requestFingerprint: `sha256:${randomUUID()}`,
            startedAt: "2026-08-10T04:00:00.000Z",
            completedAt: "2026-08-10T04:00:01.000Z",
            resultState: "succeeded" as const,
          },
          payload: {
            suggestions: [{
              word: "서늘하다",
              nuance: "감각과 분위기를 함께 암시",
              example: "서늘한 바람이 창틈으로 스며들었다.",
            }],
            note: "사용자가 원고 반영 여부를 결정합니다.",
          },
        };
      },
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "어휘 제안 작품",
        firstDocumentTitle: "1화",
      });
      const selectedText = "찬 기운";
      const manuscript = `범위 밖 문장. ${selectedText}이 복도를 메웠다.`;
      const saved = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      if (!("revisionId" in saved)) {
        throw new Error("Expected a revision save receipt");
      }
      const from = manuscript.indexOf(selectedText);
      const sourceRange = {
        documentId: created.documentId,
        documentRevisionId: saved.revisionId,
        from,
        to: from + selectedText.length,
      };
      const conversationId = randomUUID();
      await runtime.grantAssistantContextPermission({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
        capability: "vocabulary-lookup",
        destinationId: connectionId,
        localScope: "selection",
        externalScope: "selection",
        duration: "conversation",
      });
      const query = "분위기를 살리는 유의어";
      const result = await runtime.runAssistantVocabularySuggestion({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: created.workId,
        conversationId,
        connectionId,
        query,
        sourceRange,
      });

      expect(connectorCalls).toEqual([{
        requestId: expect.any(String),
        connectionId,
        query,
        context: selectedText,
      }]);
      expect(result).toMatchObject({
        status: "candidate",
        candidate: {
          workId: created.workId,
          connectionId,
          query,
          sourceRange,
          suggestions: [{ word: "서늘하다" }],
          connectorReceiptId,
        },
      });
      const beforeReopen = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      });
      expect(beforeReopen.vocabularySuggestionCandidates).toHaveLength(1);
      expect(beforeReopen.receipts).toHaveLength(1);
      expect(beforeReopen.receipts[0]).toMatchObject({
        readRanges: [sourceRange],
        transmittedRanges: [sourceRange],
        readCharacterCount: selectedText.length,
        transmittedCharacterCount: selectedText.length,
      });
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === created.documentId,
        )?.initialText,
      ).toBe(manuscript);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      })).toEqual(beforeReopen);
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === created.documentId,
        )?.initialText,
      ).toBe(manuscript);
      expect(connectorCalls).toHaveLength(1);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("sends one approved chapter and current Work settings to the selected connector and reopens read-only setting proposals", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-external-setting-review-runtime-"),
    );
    const connectionId = entityId<"AssistantConnection">(randomUUID());
    const connectorReceiptId = entityId<"ConnectorReceipt">(randomUUID());
    const connectorCalls: unknown[] = [];
    const baseOptions = createOptions(rootDirectoryPath);
    const options = {
      ...baseOptions,
      executeAssistantExternalSettingReview: async (input: Parameters<
        NonNullable<LocalWorkspaceRuntimeOptions["executeAssistantExternalSettingReview"]>
      >[0]) => {
        connectorCalls.push(input);
        const character = input.settings.find((setting) => setting.kind === "character");
        if (character === undefined) throw new Error("Expected transmitted character setting");
        return {
          receipt: {
            schemaVersion: 1 as const,
            receiptId: connectorReceiptId,
            requestId: entityId<"AssistantConnectorRequest">(input.requestId),
            connectionId,
            connectorKind: "test-structured-json",
            operation: "setting-review" as const,
            requestFingerprint: `sha256:${randomUUID()}`,
            startedAt: "2026-08-10T05:00:00.000Z",
            completedAt: "2026-08-10T05:00:01.000Z",
            resultState: "succeeded" as const,
          },
          payload: {
            reply: "현재 회차의 명시와 인물 역할을 검토했습니다.",
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
              value: "왕실 항해사",
              evidenceRange: {
                ...input.sourceRange,
                from: 0,
                to: 5,
              },
              certainty: "explicit",
            }],
            reviewNotes: [{
              kind: "conflict",
              message: "현재 역할과 회차의 명시가 다릅니다.",
              references: [{
                kind: character.kind,
                entityId: character.entityId,
                revision: character.revision,
              }],
            }],
          },
        };
      },
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "외부 설정 검토 작품",
        firstDocumentTitle: "1화",
      });
      const manuscript = "해린은 왕실 항해사였다. 다른 작품 원고는 없다.";
      const saved = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      if (!("revisionId" in saved)) throw new Error("Expected a revision save receipt");
      const character = await runtime.createCharacter({
        schemaVersion: 1,
        workId: created.workId,
        name: "해린",
        role: "항해사",
        summary: "북쪽 항구 출신",
        note: "",
      });
      const sourceRange = {
        documentId: created.documentId,
        documentRevisionId: saved.revisionId,
        from: 0,
        to: manuscript.length,
      };
      const conversationId = randomUUID();
      await runtime.grantAssistantContextPermission({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
        capability: "lore-review",
        destinationId: connectionId,
        localScope: "work",
        externalScope: "work",
        duration: "conversation",
      });

      const result = await runtime.runAssistantExternalSettingReview({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: created.workId,
        conversationId,
        connectionId,
        query: "현재 회차에 명시된 설정만 검토",
        sourceRange,
      });
      expect(connectorCalls).toEqual([expect.objectContaining({
        connectionId,
        query: "현재 회차에 명시된 설정만 검토",
        sourceRange,
        manuscript,
        settings: [expect.objectContaining({
          kind: "character",
          entityId: character.characterId,
          revision: character.revision,
          label: "해린",
        })],
      })]);
      expect(result).toMatchObject({
        status: "candidate",
        receipt: {
          sourceRange,
          transmittedSettingCount: 1,
          connectorReceiptId,
        },
        candidate: {
          query: "현재 회차에 명시된 설정만 검토",
          proposals: [{
            action: "update",
            settingKind: "character",
            value: "왕실 항해사",
          }],
          reviewNotes: [{ kind: "conflict" }],
        },
      });
      const beforeReopen = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      });
      expect(beforeReopen.externalSettingReviewReceipts).toHaveLength(1);
      expect(beforeReopen.externalSettingReviewCandidates).toHaveLength(1);
      expect(beforeReopen.receipts[0]).toMatchObject({
        readRanges: [sourceRange],
        transmittedRanges: [sourceRange],
        readCharacterCount: manuscript.length,
        transmittedCharacterCount: manuscript.length,
      });
      expect((await runtime.listCharacters({
        schemaVersion: 1,
        workId: created.workId,
      })).characters[0]).toMatchObject({ role: "항해사" });
      expect(
        runtime.getManuscriptDocumentProfile().documents.find(
          (document) => document.documentId === created.documentId,
        )?.initialText,
      ).toBe(manuscript);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      })).toEqual(beforeReopen);
      expect((await runtime.listCharacters({
        schemaVersion: 1,
        workId: created.workId,
      })).characters[0]).toMatchObject({ role: "항해사" });
      expect(connectorCalls).toHaveLength(1);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists exact-selection notation findings with no external transmission", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-notation-candidate-runtime-"),
    );
    const destinationId = `local-notation-${randomUUID()}`;
    const forbiddenTerm = `금칙-${randomUUID()}`;
    const baseOptions = createOptions(rootDirectoryPath);
    const options = {
      ...baseOptions,
      assistantDestinationProfile: parseAssistantDestinationProfile({
        schemaVersion: 1,
        destinations: [{
          destinationId,
          label: "선택 범위 표기 점검",
          kind: "local-selected-notation-review",
          capabilities: ["vocabulary-lookup"],
          requiredLocalScope: "selection",
          requiredExternalScope: "none",
        }],
      }),
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "표기 점검 작품",
        firstDocumentTitle: "1화",
      });
      const manuscript = `범위 밖 ${forbiddenTerm}\n\t선택 ${forbiddenTerm} `;
      const saved = await runtime.saveChangeBatch(parseChangeBatch({
        schemaVersion: 1,
        textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
        batchId: randomUUID(),
        workId: created.workId,
        documentId: created.documentId,
        baseRevisionId: created.revisionId,
        sequence: 0,
        createdAt: new Date().toISOString(),
        beforeTextLengthUtf16: 0,
        afterTextLengthUtf16: manuscript.length,
        changes: [{ fromUtf16: 0, toUtf16: 0, insertedText: manuscript }],
      }));
      if (!("revisionId" in saved)) {
        throw new Error("Expected a revision save receipt");
      }
      await runtime.saveManuscriptPreflightSettings({
        schemaVersion: 1,
        workId: created.workId,
        settings: {
          ...baseOptions.preflightProfile.defaults,
          forbiddenTerms: [forbiddenTerm],
        },
      });
      const selectionFrom = manuscript.indexOf("\t");
      const sourceRange = {
        documentId: created.documentId,
        documentRevisionId: saved.revisionId,
        from: selectionFrom,
        to: manuscript.length,
      };
      const conversationId = randomUUID();
      await runtime.grantAssistantContextPermission({
        schemaVersion: 1,
        workId: created.workId,
        conversationId: null,
        capability: "vocabulary-lookup",
        destinationId,
        localScope: "selection",
        externalScope: "none",
        duration: "work",
      });

      const result = await runtime.runAssistantNotationReview({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: created.workId,
        conversationId,
        destinationId,
        sourceRange,
      });
      expect(result).toMatchObject({
        status: "candidate",
        candidate: {
          sourceRange,
          findings: expect.arrayContaining([
            expect.objectContaining({ kind: "tab" }),
            expect.objectContaining({
              kind: "forbidden-term",
              label: forbiddenTerm,
            }),
            expect.objectContaining({ kind: "trailing-whitespace" }),
          ]),
        },
      });
      if (result.status !== "candidate") {
        throw new Error("Expected a notation Candidate");
      }
      expect(result.candidate.findings.every((finding) =>
        finding.range.from >= sourceRange.from && finding.range.to <= sourceRange.to
      )).toBe(true);
      expect(result.candidate.findings.filter((finding) =>
        finding.kind === "forbidden-term"
      )).toHaveLength(1);

      const state = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      });
      expect(state.notationCandidates).toEqual([result.candidate]);
      expect(state.receipts[0]).toMatchObject({
        readRanges: [sourceRange],
        transmittedRanges: [],
        readCharacterCount: sourceRange.to - sourceRange.from,
        transmittedCharacterCount: 0,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect(await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      })).toEqual(state);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists exact duplicate setting review findings without changing canonical settings", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-setting-review-runtime-"),
    );
    const destinationId = `local-setting-review-${randomUUID()}`;
    const options = {
      ...createOptions(rootDirectoryPath),
      assistantDestinationProfile: parseAssistantDestinationProfile({
        schemaVersion: 1,
        destinations: [{
          destinationId,
          label: "설정 중복 검토",
          kind: "local-exact-setting-review",
          capabilities: ["lore-review"],
          requiredLocalScope: "work",
          requiredExternalScope: "none",
        }],
      }),
    } as const;
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: "설정 검토 작품",
        firstDocumentTitle: "1화",
      });
      const firstCharacter = await runtime.createCharacter({
        schemaVersion: 1,
        workId: created.workId,
        name: "해린",
        role: "주인공",
        summary: "같은 요약",
        note: "",
      });
      const secondCharacter = await runtime.createCharacter({
        schemaVersion: 1,
        workId: created.workId,
        name: "해린",
        role: "조연",
        summary: "같은 요약",
        note: "",
      });
      await runtime.createPlotThread({
        schemaVersion: 1,
        workId: created.workId,
        title: "해린",
        stage: "초반",
        summary: "인물과 이름만 같은 플롯",
        note: "",
      });
      await runtime.createForeshadowLine({
        schemaVersion: 1,
        workId: created.workId,
        title: "푸른 문",
        note: "",
      });
      const conversationId = randomUUID();
      expect(await runtime.runAssistantSettingReview({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: created.workId,
        conversationId,
        destinationId,
      })).toEqual({
        schemaVersion: 1,
        status: "permission-required",
        missing: ["local-read"],
      });
      await runtime.grantAssistantContextPermission({
        schemaVersion: 1,
        workId: created.workId,
        conversationId: null,
        capability: "lore-review",
        destinationId,
        localScope: "work",
        externalScope: "none",
        duration: "work",
      });

      const result = await runtime.runAssistantSettingReview({
        schemaVersion: 1,
        requestId: randomUUID(),
        workId: created.workId,
        conversationId,
        destinationId,
      });
      expect(result).toMatchObject({
        status: "reviewed",
        receipt: {
          workId: created.workId,
          reviewedSettings: expect.arrayContaining([
            {
              kind: "character",
              entityId: firstCharacter.characterId,
              revision: firstCharacter.revision,
            },
            {
              kind: "character",
              entityId: secondCharacter.characterId,
              revision: secondCharacter.revision,
            },
          ]),
          transmittedSettingCount: 0,
        },
        findings: [{
          kind: "duplicate",
          settingKind: "character",
          label: "해린",
          references: expect.arrayContaining([
            expect.objectContaining({
              kind: "character",
              entityId: firstCharacter.characterId,
            }),
            expect.objectContaining({
              kind: "character",
              entityId: secondCharacter.characterId,
            }),
          ]),
        }],
        conflicts: [{
          kind: "conflict",
          settingKind: "character",
          label: "해린",
          field: "role",
          references: expect.arrayContaining([
            expect.objectContaining({
              kind: "character",
              entityId: firstCharacter.characterId,
            }),
            expect.objectContaining({
              kind: "character",
              entityId: secondCharacter.characterId,
            }),
          ]),
        }],
      });
      if (result.status !== "reviewed") {
        throw new Error("Expected a completed setting review");
      }
      expect(JSON.stringify(result.receipt)).not.toContain("해린");

      const charactersBeforeRestart = await runtime.listCharacters({
        schemaVersion: 1,
        workId: created.workId,
      });
      const state = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId,
      });
      expect(state.settingReviewReceipts).toHaveLength(1);
      expect(state.settingReviewFindings).toHaveLength(1);
      expect(state.settingConflictFindings).toHaveLength(1);

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      const reopenedState = await runtime.listAssistantContextState({
        schemaVersion: 1,
        workId: created.workId,
        conversationId: randomUUID(),
      });
      expect(reopenedState.settingReviewReceipts).toEqual(
        state.settingReviewReceipts,
      );
      expect(reopenedState.settingReviewFindings).toEqual(
        state.settingReviewFindings,
      );
      expect(reopenedState.settingConflictFindings).toEqual(
        state.settingConflictFindings,
      );
      expect(await runtime.listCharacters({
        schemaVersion: 1,
        workId: created.workId,
      })).toEqual(charactersBeforeRestart);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });

  it("creates a verified backup bundle and restores the exact workspace into a new location", async () => {
    const parentDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-local-backup-"),
    );
    const sourceRootDirectoryPath = path.join(
      parentDirectoryPath,
      "source-workspace",
    );
    const bundleRootDirectoryPath = path.join(
      parentDirectoryPath,
      "verified-backup",
    );
    const restoredRootDirectoryPath = path.join(
      parentDirectoryPath,
      "restored-workspace",
    );
    const options = createOptions(sourceRootDirectoryPath);
    const manuscript = `복원할 원고 ${randomUUID()}`;
    let runtime = await openLocalWorkspaceRuntime(options);
    let restoredRuntime: Awaited<
      ReturnType<typeof openLocalWorkspaceRuntime>
    > | null = null;

    try {
      const created = await runtime.createFirstWork({
        schemaVersion: 1,
        title: `백업 작품 ${randomUUID()}`,
        firstDocumentTitle: "1화",
      });
      const receipt = await runtime.saveChangeBatch(
        parseChangeBatch({
          schemaVersion: 1,
          textRepresentation: DURABLE_TEXT_REPRESENTATION_V1,
          batchId: randomUUID(),
          workId: created.workId,
          documentId: created.documentId,
          baseRevisionId: created.revisionId,
          sequence: 0,
          createdAt: new Date().toISOString(),
          beforeTextLengthUtf16: 0,
          afterTextLengthUtf16: manuscript.length,
          changes: [
            {
              fromUtf16: 0,
              toUtf16: 0,
              insertedText: manuscript,
            },
          ],
        }),
      );
      expect(receipt).toHaveProperty("revisionId");

      const createdBackup = await runtime.createBackupBundle(
        bundleRootDirectoryPath,
      );
      expect(createdBackup).toMatchObject({
        bundlePath: path.resolve(bundleRootDirectoryPath),
        targetPath: null,
        lastAction: "created",
        counts: {
          workCount: 1,
          documentCount: 1,
          revisionCount: 2,
        },
      });

      const restoredBackup = await runtime.restoreBackupBundle(
        bundleRootDirectoryPath,
        restoredRootDirectoryPath,
      );
      expect(restoredBackup).toMatchObject({
        bundlePath: path.resolve(bundleRootDirectoryPath),
        targetPath: path.resolve(restoredRootDirectoryPath),
        lastAction: "restored",
        counts: createdBackup.counts,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      expect((await runtime.getBackupStatus()).lastVerified).toEqual(
        restoredBackup,
      );

      restoredRuntime = await openLocalWorkspaceRuntime({
        ...options,
        rootDirectoryPath: restoredRootDirectoryPath,
      });
      expect(
        restoredRuntime.getManuscriptDocumentProfile().documents[0],
      ).toMatchObject({
        workId: created.workId,
        documentId: created.documentId,
        initialText: manuscript,
      });
    } finally {
      restoredRuntime?.close();
      runtime.close();
      await rm(parentDirectoryPath, { recursive: true, force: true });
    }
  });

  it("persists music settings only for the selected Work", async () => {
    const rootDirectoryPath = await mkdtemp(
      path.join(tmpdir(), "eum-studio-music-settings-runtime-"),
    );
    const options = createOptions(rootDirectoryPath);
    let runtime = await openLocalWorkspaceRuntime(options);
    try {
      const first = await runtime.createFirstWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const second = await runtime.createWork({
        schemaVersion: 1,
        title: randomUUID(),
        firstDocumentTitle: randomUUID(),
      });
      const initial = await runtime.getWorkMusicSettings({
        schemaVersion: 1,
        workId: first.workId,
      });
      const saved = await runtime.saveWorkMusicSettings({
        schemaVersion: 1,
        workId: first.workId,
        expectedRevision: initial.revision,
        settings: {
          ...initial.settings,
          autoOnEpisodeTransition: true,
          transitionPlaybackMode: "ask",
        },
      });

      expect(saved).toMatchObject({
        workId: first.workId,
        revision: 1,
        settings: {
          autoOnEpisodeTransition: true,
          transitionPlaybackMode: "ask",
        },
      });
      await expect(runtime.getWorkMusicSettings({
        schemaVersion: 1,
        workId: second.workId,
      })).resolves.toMatchObject({
        workId: second.workId,
        revision: 0,
        settings: options.musicSettingsProfile.workDefaults,
      });

      runtime.close();
      runtime = await openLocalWorkspaceRuntime(options);
      await expect(runtime.getWorkMusicSettings({
        schemaVersion: 1,
        workId: first.workId,
      })).resolves.toEqual(saved);
    } finally {
      runtime.close();
      await rm(rootDirectoryPath, { recursive: true, force: true });
    }
  });
});
