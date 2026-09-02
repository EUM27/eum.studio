import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync, expect, test, electron, continueFromMain, removeVerifiedTemporaryDirectory, type Page } from "./support/desktop-shell-suite";

type RunningElectron = Awaited<ReturnType<typeof electron.launch>>;
function diagnostics(app: RunningElectron): void {
  app.process().stderr?.on("data", (chunk) =>
    process.stderr.write(`[canonical-markdown-e2e stderr] ${String(chunk)}`)
  );
}
async function closeElectron(app: RunningElectron): Promise<void> {
  const child = app.process();
  const closed = await Promise.race([
    app.close().then(() => true, () => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (!closed && child.exitCode === null && child.signalCode === null) {
    const exit = once(child, "exit").catch(() => undefined);
    child.kill("SIGKILL");
    await exit;
  }
}
async function openCanon(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "작품 작업면" })
    .getByRole("button", { name: "별빛", exact: true }).click();
  await expect(page.getByRole("region", { name: "별빛 작업" })).toBeVisible();
}
async function exportFromCanon(page: Page): Promise<void> {
  await openCanon(page);
  const button = page.getByRole("button", { name: "별빛 Markdown 내보내기", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("region", { name: "별빛 작업" }))
    .toContainText(/11개 Markdown을 .+ 폴더에 내보냈습니다\./u);
}
async function readBundle(root: string): Promise<ReadonlyMap<string, string>> {
  const result = new Map<string, string>();
  const visit = async (directory: string, prefix: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else result.set(relative, await readFile(absolute, "utf8"));
    }
  };
  await visit(root, "");
  return result;
}

test("exports every canonical ledger to a one-way Obsidian Markdown bundle without importing edits", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-canonical-markdown-e2e-"));
  const exportRoot = path.join(directory, "exports");
  await mkdir(exportRoot);
  const suffix = randomUUID().slice(0, 8);
  const workTitle = `북문 연대기 ${suffix}`;
  const characterName = `윤서 ${suffix}`;
  const marker = `외부 Markdown 편집 ${randomUUID()}`;
  const args = [".", `--user-data-dir=${path.join(directory, "electron-user-data")}`];
  const env = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_CANONICAL_MARKDOWN_EXPORT_ROOT_PATH: exportRoot,
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
  };
  let app = await electron.launch({ args, cwd: process.cwd(), env });
  diagnostics(app);
  try {
    let page = await app.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "새 작품 만들기" });
    await dialog.getByLabel("작품 제목").fill(workTitle);
    await dialog.getByLabel("첫 회차 제목").fill("1화");
    await dialog.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const manuscript = page.getByRole("textbox", { name: "원고" });
    await manuscript.pressSequentially(`윤서는 북문의 열쇠를 찾았다 ${suffix}.`);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");

    const seeded = await page.evaluate(async ({ characterName }) => {
      const catalog = await window.eumStudio.workspace.getCatalog();
      if (catalog.activeWorkId === null) throw new Error("Expected active Work");
      const workId = catalog.activeWorkId;
      const baseCharacter = {
        schemaVersion: 1 as const,
        workId,
        aliases: [] as string[],
        role: "",
        summary: "",
        appearance: "",
        personality: "",
        speech: "",
        goal: "",
        conflict: "",
        note: "",
      };
      const character = await window.eumStudio.characters.create({ ...baseCharacter, name: characterName });
      const keeper = await window.eumStudio.characters.create({ ...baseCharacter, name: "문지기" });
      await window.eumStudio.characters.createRelation({
        schemaVersion: 1,
        workId,
        fromCharacterId: character.characterId,
        toCharacterId: keeper.characterId,
        kind: "동료",
        description: "북문을 함께 지킨다.",
      });
      const lore = await window.eumStudio.loreEntries.create({
        schemaVersion: 1,
        workId,
        title: "북문",
        content: "밤에는 닫힌다.",
        category: "장소",
        aliases: [],
        enabled: true,
        evidence: null,
      });
      await window.eumStudio.structure.createAnchorlessEvent({
        schemaVersion: 1,
        workId,
        title: "열쇠 발견",
        note: "윤서가 열쇠를 찾았다.",
      });
      await window.eumStudio.plots.create({
        schemaVersion: 1,
        workId,
        title: "북문 개방",
        stage: "예정",
        summary: "북문을 연다.",
        note: "",
      });
      await window.eumStudio.foreshadowing.createLine({
        schemaVersion: 1,
        workId,
        title: "열쇠의 약속",
        note: "후반부에 회수한다.",
      });
      const scene = (await window.eumStudio.structure.listSceneProjection({
        schemaVersion: 1,
        workId,
      })).scenes.find((candidate) => candidate.range !== null && candidate.integrity === "resolved");
      if (scene === undefined || scene.range === null) throw new Error("Expected Scene");
      await window.eumStudio.structure.finalizeSceneCanonCheck({
        schemaVersion: 1,
        workId,
        sceneKey: scene.sceneKey,
        documentId: scene.documentId,
        documentRevisionId: scene.documentRevisionId,
        from: scene.range.start,
        to: scene.range.end,
      });
      await window.eumStudio.continuity.create({
        schemaVersion: 1,
        workId,
        kind: "promise",
        title: "열쇠를 돌려주기",
        note: "문지기와의 약속",
        subjectRefs: [{ kind: "character", id: character.characterId }],
        openedEvidenceRange: null,
      });
      await window.eumStudio.characterKnowledge.create({
        schemaVersion: 1,
        workId,
        characterId: character.characterId,
        statement: "북문은 밤에 닫힌다",
        stance: "knows",
        truthStatus: "true",
        aboutRefs: [{ kind: "lore-entry", id: lore.loreEntryId }],
        evidenceRange: null,
      });
      return {
        workId,
        characterId: character.characterId,
        canonMethods: Object.keys(window.eumStudio.canon).sort(),
      };
    }, { characterName });
    expect(seeded.canonMethods).toContain("exportMarkdown");
    expect(seeded.canonMethods.some((name) => /import|sync|watch|writeback/iu.test(name))).toBe(false);

    await exportFromCanon(page);
    const firstDirectories = (await readdir(exportRoot)).sort();
    expect(firstDirectories).toHaveLength(1);
    const firstRoot = path.join(exportRoot, firstDirectories[0]!);
    const firstBundle = await readBundle(firstRoot);
    expect(firstBundle.size).toBe(11);
    expect(firstBundle.get("00-별빛-색인.md")).toContain('export_direction: "canonical-to-markdown"');
    expect(firstBundle.get("00-별빛-색인.md")).toContain("Markdown 재가져오기와 양방향 동기화는 지원하지 않습니다");
    const firstCharacterPath = [...firstBundle.keys()].find((relative) =>
      relative.startsWith("인물/") && firstBundle.get(relative)?.includes(`# ${characterName}`)
    );
    const relationText = [...firstBundle].find(([relative]) => relative.startsWith("인물-관계/"))?.[1];
    expect(firstCharacterPath).toBeDefined();
    expect(relationText).toContain("[[인물/");

    await closeElectron(app);
    await writeFile(path.join(firstRoot, firstCharacterPath!), `${firstBundle.get(firstCharacterPath!)}\n${marker}\n`, "utf8");
    app = await electron.launch({ args, cwd: process.cwd(), env });
    diagnostics(app);
    page = await app.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await continueFromMain(page);
    await expect(page.evaluate(async ({ workId, characterId }) => {
      const characters = await window.eumStudio.characters.list({ schemaVersion: 1, workId });
      return characters.characters.find((candidate) => candidate.characterId === characterId)?.name;
    }, seeded)).resolves.toBe(characterName);
    await exportFromCanon(page);
    const publishedDirectories = (await readdir(exportRoot)).sort();
    expect(publishedDirectories).toEqual([firstDirectories[0]!, `${firstDirectories[0]}-2`]);
    const secondBundle = await readBundle(path.join(exportRoot, publishedDirectories[1]!));
    expect(secondBundle.size).toBe(firstBundle.size);
    expect([...secondBundle.values()].some((content) => content.includes(marker))).toBe(false);
    for (const [relative, content] of firstBundle) {
      expect(secondBundle.get(relative)).toBe(content);
    }

    await closeElectron(app);
    const audit = new DatabaseSync(path.join(directory, "workspace.sqlite3"), { readOnly: true });
    try {
      expect(audit.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(audit.prepare("SELECT COUNT(*) AS count FROM characters WHERE work_id = ?").get(seeded.workId))
        .toEqual({ count: 2 });
    } finally {
      audit.close();
    }
  } finally {
    await closeElectron(app).catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
