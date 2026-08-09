import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { expect as expectPlaywright } from "@playwright/test";
import { _electron as electron, type Page } from "playwright";
import { describe, expect, it } from "vitest";

import type { ManuscriptDocumentProfile } from "../../src/application/editor/manuscript-document-profile";
import { searchManuscriptsForWork } from "../../src/application/editor/search-manuscripts";
import { createEnvironmentManifest } from "../../src/application/measurement/environment-manifest";
import {
  createPoc1PerformanceReport,
  renderPoc1PerformanceVerdict,
} from "../../src/application/measurement/poc-1-performance-report";
import {
  parsePoc1PerformanceProfile,
  type Poc1PerformanceProfile,
  type Poc1PerformanceScenarioKind,
  type Poc1PerformanceScenarioProfile,
} from "../../src/application/measurement/poc-1-performance-profile";
import { entityId } from "../../src/domain/writing";
import {
  generateLongformFixture,
  parseLongformFixtureManifest,
  type LongformFixtureDocument,
} from "../fixtures/longform/longform-fixture";

type PackageManifest = {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

type LockManifest = {
  readonly packages?: Readonly<
    Record<string, { readonly version?: string }>
  >;
};

type GeneratedDocument = LongformFixtureDocument & {
  readonly workId: string;
  readonly label: string;
};

const performanceProfilePath = path.resolve(
  "tests",
  "fixtures",
  "performance",
  "poc-1-performance.manifest.json",
);

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function relativeArtifactPath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function scenarioFor(
  profile: Poc1PerformanceProfile,
  kind: Poc1PerformanceScenarioKind,
): Poc1PerformanceScenarioProfile {
  const scenario = profile.scenarios.find(
    (candidate) => candidate.kind === kind,
  );
  if (scenario === undefined) {
    throw new Error(`Missing performance scenario: ${kind}`);
  }
  return scenario;
}

function createEnvironment() {
  const packageManifest = readJson(
    path.resolve("package.json"),
  ) as PackageManifest;
  const lockManifest = readJson(
    path.resolve("package-lock.json"),
  ) as LockManifest;
  const dependencyNames = new Set([
    ...Object.keys(packageManifest.dependencies ?? {}),
    ...Object.keys(packageManifest.devDependencies ?? {}),
  ]);
  const packages = [...dependencyNames].map((name) => {
    const version =
      lockManifest.packages?.[`node_modules/${name}`]?.version;
    if (version === undefined) {
      throw new Error(`Missing installed package version: ${name}`);
    }
    return { name, version };
  });
  const processors = os.cpus();
  return createEnvironmentManifest({
    capturedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    nodeVersion: process.version,
    cpuModel: [...new Set(processors.map((cpu) => cpu.model))].join(
      " | ",
    ),
    logicalProcessorCount: processors.length,
    totalMemoryBytes: os.totalmem(),
    packages,
  });
}

function countGraphemes(value: string): number {
  return Array.from(
    new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    }).segment(value),
  ).length;
}

async function activateDocument(input: {
  readonly page: Page;
  readonly document: GeneratedDocument;
  readonly expectedCharacterCount: number;
}): Promise<void> {
  await input.page
    .getByRole("combobox", { name: "문서 전환" })
    .selectOption(input.document.documentId);
  await expectPlaywright(
    input.page.locator(".workspace-center"),
  ).toHaveAttribute(
    "data-active-document-id",
    input.document.documentId,
  );
  await expectPlaywright(
    input.page.getByTestId("manuscript-character-count"),
  ).toHaveText(String(input.expectedCharacterCount));
}

function createSwitchTargets(
  works: readonly {
    readonly documents: readonly GeneratedDocument[];
  }[],
  count: number,
): GeneratedDocument[] {
  return Array.from({ length: count }, (_, index) => {
    const work = works[index % works.length];
    if (work === undefined || work.documents.length === 0) {
      throw new Error("Longform fixture Work must contain documents");
    }
    const documentIndex =
      Math.floor(index / works.length) % work.documents.length;
    return work.documents[documentIndex]!;
  });
}

async function readRenderedManuscript(page: Page): Promise<string> {
  return page.locator(".cm-content").evaluate((content) =>
    Array.from(content.querySelectorAll(".cm-line"))
      .map((line) => line.textContent ?? "")
      .join("\n"),
  );
}

async function prepareSearchMeasurement(input: {
  readonly page: Page;
  readonly measurementKey: string;
  readonly previousSequence: number;
}): Promise<void> {
  await input.page.evaluate(
    ({ measurementKey, previousSequence }) => {
      const searchForm = document.querySelector('form[role="search"]');
      const searchRail = document.querySelector(
        ".workspace-rail-left",
      );
      if (searchForm === null || searchRail === null) {
        throw new Error("Search measurement surface is unavailable");
      }
      const measurement = new Promise<number>((resolve) => {
        let startedAt: number | null = null;
        const handleSubmit = () => {
          startedAt = performance.now();
        };
        const observer = new MutationObserver(() => {
          const sequence = Number(
            document.querySelector(
              '[data-testid="search-run-sequence"]',
            )?.textContent,
          );
          if (
            startedAt !== null &&
            Number.isFinite(sequence) &&
            sequence > previousSequence
          ) {
            const duration = performance.now() - startedAt;
            observer.disconnect();
            searchForm.removeEventListener(
              "submit",
              handleSubmit,
              true,
            );
            resolve(duration);
          }
        });
        searchForm.addEventListener("submit", handleSubmit, {
          capture: true,
          once: true,
        });
        observer.observe(searchRail, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });
      Reflect.set(globalThis, measurementKey, measurement);
    },
    {
      measurementKey: input.measurementKey,
      previousSequence: input.previousSequence,
    },
  );
}

async function readBrowserMeasurement(
  page: Page,
  measurementKey: string,
): Promise<number> {
  return page.evaluate(async (key) => {
    const measurement = Reflect.get(globalThis, key);
    if (!(measurement instanceof Promise)) {
      throw new Error(`Missing browser measurement: ${key}`);
    }
    const duration = (await measurement) as number;
    Reflect.deleteProperty(globalThis, key);
    return duration;
  }, measurementKey);
}

async function prepareInputMeasurement(input: {
  readonly page: Page;
  readonly measurementKey: string;
}): Promise<void> {
  await input.page.evaluate(
    ({ measurementKey }) => {
      const editor = document.querySelector(
        '[role="textbox"][aria-label="원고"]',
      );
      if (editor === null) {
        throw new Error("Input measurement surface is unavailable");
      }
      const measurement = new Promise<number>((resolve) => {
        let startedAt: number | null = null;
        const handleBeforeInput = () => {
          startedAt ??= performance.now();
        };
        const handleInput = () => {
          if (startedAt !== null) {
            const duration = performance.now() - startedAt;
            editor.removeEventListener(
              "beforeinput",
              handleBeforeInput,
              true,
            );
            editor.removeEventListener("input", handleInput, true);
            resolve(duration);
          }
        };
        editor.addEventListener("beforeinput", handleBeforeInput, {
          capture: true,
        });
        editor.addEventListener("input", handleInput, {
          capture: true,
        });
      });
      Reflect.set(globalThis, measurementKey, measurement);
    },
    {
      measurementKey: input.measurementKey,
    },
  );
}

describe("POC-1 longform performance", () => {
  it("measures document switching, Work search, and input in the packaged Electron surface", async () => {
    const runId = randomUUID();
    const performanceProfileRaw = readFileSync(
      performanceProfilePath,
      "utf8",
    );
    const performanceProfile = parsePoc1PerformanceProfile(
      JSON.parse(performanceProfileRaw) as unknown,
    );
    const longformManifestPath = path.resolve(
      performanceProfile.longformFixturePath,
    );
    const longformManifestRaw = readFileSync(
      longformManifestPath,
      "utf8",
    );
    const longformManifest = parseLongformFixtureManifest(
      JSON.parse(longformManifestRaw) as unknown,
    );
    const fixture = generateLongformFixture(longformManifest);
    const works = fixture.works.map((work) => ({
      workId: work.workId,
      documents: work.documents.map((document) => ({
        ...document,
        workId: work.workId,
        label: document.documentId,
      })),
    }));
    const documents = works.flatMap((work) => work.documents);
    const initialDocument = documents.reduce((longest, document) =>
      document.manuscript.length > longest.manuscript.length
        ? document
        : longest,
    );
    const documentProfile: ManuscriptDocumentProfile = {
      schemaVersion: 1,
      initialDocumentId: entityId<"Document">(
        initialDocument.documentId,
      ),
      documents: documents.map((document) => ({
        workId: entityId<"Work">(document.workId),
        documentId: entityId<"Document">(document.documentId),
        documentRevisionId: null,
        label: document.label,
        initialText: document.manuscript,
      })),
    };
    const artifactDirectory = path.resolve(
      performanceProfile.artifactDirectory,
      runId,
    );
    mkdirSync(artifactDirectory, { recursive: true });
    const generatedProfilePath = path.join(
      artifactDirectory,
      "manuscript-profile.json",
    );
    const generatedProfileRaw = JSON.stringify(documentProfile);
    writeFileSync(generatedProfilePath, generatedProfileRaw, "utf8");
    const environment = createEnvironment();
    const environmentPath = path.join(
      artifactDirectory,
      "environment.json",
    );
    writeFileSync(
      environmentPath,
      `${JSON.stringify(environment, null, 2)}\n`,
      "utf8",
    );
    const reportPath = path.join(
      artifactDirectory,
      "measurement.json",
    );
    const verdictPath = path.join(
      artifactDirectory,
      "verdict.md",
    );
    const screenshotPath = path.join(
      artifactDirectory,
      "final-surface.png",
    );
    const expectedCharacterCounts = new Map(
      documents.map((document) => [
        document.documentId,
        countGraphemes(document.manuscript),
      ]),
    );
    const scenarioDurations: Record<string, number[]> =
      Object.fromEntries(
        performanceProfile.scenarios.map((scenario) => [
          scenario.id,
          [],
        ]),
      );
    let documentSwitchCount = 0;
    let ownershipViolationCount = 0;
    let searchMismatchCount = 0;
    let inputMismatchCount = 0;
    const consoleErrors: string[] = [];
    const appEnvironment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined,
      ),
    );
    delete appEnvironment.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE;
    appEnvironment.EUM_STUDIO_MANUSCRIPT_DOCUMENT_PROFILE_PATH =
      generatedProfilePath;
    appEnvironment.EUM_STUDIO_WINDOW_VISIBILITY = "hidden";
    const electronApp = await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: appEnvironment,
    });

    try {
      const page = await electronApp.firstWindow();
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.getByRole("button", {
        name: "작업실",
        exact: true,
      }).click();
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      await expectPlaywright(page.getByTestId("runtime-status")).toContainText(
        "연결됨",
      );
      await expectPlaywright(
        page.locator(".workspace-center"),
      ).toHaveAttribute(
        "data-active-document-id",
        initialDocument.documentId,
      );

      const probeDocuments = works.map((work) =>
        work.documents.reduce((shortest, document) =>
          document.manuscript.length < shortest.manuscript.length
            ? document
            : shortest,
        ),
      );
      const probes = new Map<string, string>();
      for (const document of probeDocuments) {
        const probe = randomUUID();
        probes.set(document.documentId, probe);
        await activateDocument({
          page,
          document,
          expectedCharacterCount:
            expectedCharacterCounts.get(document.documentId)!,
        });
        const manuscript = page.getByRole("textbox", { name: "원고" });
        await manuscript.press("Control+End");
        await manuscript.pressSequentially(probe);
        expectedCharacterCounts.set(
          document.documentId,
          expectedCharacterCounts.get(document.documentId)! +
            countGraphemes(probe),
        );
        await expectPlaywright(
          page.getByTestId("manuscript-character-count"),
        ).toHaveText(
          String(expectedCharacterCounts.get(document.documentId)),
        );
      }

      const switchScenario = scenarioFor(
        performanceProfile,
        "document-switch",
      );
      const switchTargets = createSwitchTargets(
        works,
        switchScenario.warmupCount + switchScenario.sampleCount,
      );
      for (const [index, document] of switchTargets.entries()) {
        const startedAt = performance.now();
        await activateDocument({
          page,
          document,
          expectedCharacterCount:
            expectedCharacterCounts.get(document.documentId)!,
        });
        const duration = performance.now() - startedAt;
        if (index >= switchScenario.warmupCount) {
          scenarioDurations[switchScenario.id]!.push(duration);
          documentSwitchCount += 1;
        }
        const activeDocumentId = await page
          .locator(".workspace-center")
          .getAttribute("data-active-document-id");
        if (activeDocumentId !== document.documentId) {
          ownershipViolationCount += 1;
        }
      }
      for (const document of probeDocuments) {
        await activateDocument({
          page,
          document,
          expectedCharacterCount:
            expectedCharacterCounts.get(document.documentId)!,
        });
        const rendered = await readRenderedManuscript(page);
        const ownProbe = probes.get(document.documentId)!;
        const foreignProbes = [...probes.entries()]
          .filter(([documentId]) => documentId !== document.documentId)
          .map(([, probe]) => probe);
        if (
          !rendered.includes(ownProbe) ||
          foreignProbes.some((probe) => rendered.includes(probe))
        ) {
          ownershipViolationCount += 1;
        }
      }

      const searchWork = works[0]!;
      const searchDocument = searchWork.documents[0]!;
      await activateDocument({
        page,
        document: searchDocument,
        expectedCharacterCount:
          expectedCharacterCounts.get(searchDocument.documentId)!,
      });
      const searchScenario = scenarioFor(
        performanceProfile,
        "work-search",
      );
      const searchInput = page.getByRole("searchbox", {
        name: "원고 검색",
      });
      const searchSequence = page.getByTestId("search-run-sequence");
      const searchSummary = page.getByTestId("search-result-summary");
      const searchRuns =
        searchScenario.warmupCount + searchScenario.sampleCount;
      for (let index = 0; index < searchRuns; index += 1) {
        const query =
          performanceProfile.searchQueries[
            index % performanceProfile.searchQueries.length
          ]!;
        const expectedResult = searchManuscriptsForWork({
          workId: entityId<"Work">(searchWork.workId),
          documents: documentProfile.documents,
          query,
          readManuscript: (document) => document.initialText,
        });
        const previousSequence =
          (await searchSequence.count()) === 0
            ? 0
            : Number(await searchSequence.textContent());
        await searchInput.fill(query);
        const measurementKey = `${runId}:search:${index}`;
        await prepareSearchMeasurement({
          page,
          measurementKey,
          previousSequence,
        });
        await page.getByRole("button", { name: "검색" }).click();
        const duration = await readBrowserMeasurement(
          page,
          measurementKey,
        );
        const expectedSummary = `${expectedResult.matchingDocumentCount}개 문서 · ${expectedResult.totalMatchCount}개 일치`;
        await expectPlaywright(searchSummary).toHaveText(
          expectedSummary,
        );
        if (index >= searchScenario.warmupCount) {
          scenarioDurations[searchScenario.id]!.push(duration);
        }
        if ((await searchSummary.textContent()) !== expectedSummary) {
          searchMismatchCount += 1;
        }
      }

      await activateDocument({
        page,
        document: initialDocument,
        expectedCharacterCount:
          expectedCharacterCounts.get(initialDocument.documentId)!,
      });
      const manuscript = page.getByRole("textbox", { name: "원고" });
      const inputSession = await page.context().newCDPSession(page);
      await manuscript.focus();
      await manuscript.press("Control+End");
      const inputScenario = scenarioFor(
        performanceProfile,
        "input",
      );
      const inputRuns =
        inputScenario.warmupCount + inputScenario.sampleCount;
      for (let index = 0; index < inputRuns; index += 1) {
        const sample =
          performanceProfile.inputSamples[
            index % performanceProfile.inputSamples.length
          ]!;
        const beforeCount = Number(
          await page
            .getByTestId("manuscript-character-count")
            .textContent(),
        );
        const expectedCount = beforeCount + countGraphemes(sample);
        const measurementKey = `${runId}:input:${index}`;
        await prepareInputMeasurement({
          page,
          measurementKey,
        });
        await inputSession.send("Input.imeSetComposition", {
          text: sample,
          selectionStart: sample.length,
          selectionEnd: sample.length,
          replacementStart: 0,
          replacementEnd: 0,
        });
        await inputSession.send("Input.insertText", { text: sample });
        const duration = await readBrowserMeasurement(
          page,
          measurementKey,
        );
        await expectPlaywright(
          page.getByTestId("manuscript-character-count"),
        ).toHaveText(String(expectedCount));
        if (index >= inputScenario.warmupCount) {
          scenarioDurations[inputScenario.id]!.push(duration);
        }
        const actualCount = Number(
          await page
            .getByTestId("manuscript-character-count")
            .textContent(),
        );
        if (actualCount !== expectedCount) {
          inputMismatchCount += 1;
        }
        await manuscript.press("Control+Z");
        await expectPlaywright(
          page.getByTestId("manuscript-character-count"),
        ).toHaveText(String(beforeCount));
      }
      await inputSession.detach();
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } finally {
      await electronApp.close();
    }

    const commitId = execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: process.cwd(), encoding: "utf8" },
    ).trim();
    const sourceState =
      execFileSync("git", ["status", "--porcelain"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }).trim().length === 0
        ? "clean"
        : "dirty";
    const artifactRefs = [
      relativeArtifactPath(generatedProfilePath),
      relativeArtifactPath(environmentPath),
      relativeArtifactPath(screenshotPath),
      relativeArtifactPath(reportPath),
      relativeArtifactPath(verdictPath),
    ];
    const report = createPoc1PerformanceReport({
      runId,
      commitId,
      sourceState,
      capturedAt: new Date().toISOString(),
      environment,
      fixture: {
        manifestPath: relativeArtifactPath(longformManifestPath),
        manifestChecksum: digest(longformManifestRaw),
        generatedProfileChecksum: digest(generatedProfileRaw),
      },
      performanceProfile,
      performanceProfileChecksum: digest(performanceProfileRaw),
      scenarioDurations,
      correctness: {
        documentSwitchCount,
        ownershipViolationCount,
        searchMismatchCount,
        inputMismatchCount,
      },
      artifactRefs,
    });
    writeFileSync(
      reportPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      verdictPath,
      renderPoc1PerformanceVerdict(report),
      "utf8",
    );

    expect(consoleErrors).toEqual([]);
    expect(report.verdict).toBe("pass");
    process.stdout.write(
      `\nPOC-1 report: ${relativeArtifactPath(reportPath)}\n`,
    );
  });
});
