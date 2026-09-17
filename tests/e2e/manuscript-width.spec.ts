import { readFile } from "node:fs/promises";
import {
  electron, expect, expectEditorText, mkdtemp, path, randomUUID,
  removeVerifiedTemporaryDirectory, test, tmpdir, writeFile,
} from "./support/desktop-shell-suite";

test("changes manuscript line width without moving or resizing its background", async () => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(await readFile(path.join(process.cwd(), "tests", "fixtures", "editor", "manuscript-width.manifest.json"), "utf8")) as {
    text: string;
    themes: { label: string; id: string }[];
  };
  const directory = await mkdtemp(path.join(tmpdir(), "eum-manuscript-width-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${path.join(directory, "user-data")}`],
    cwd: process.cwd(),
    env: {
      ...process.env,
      EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
      EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: path.join(directory, "workspace"),
      EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
    },
  });
  let succeeded = false;
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const create = page.getByRole("dialog", { name: "새 작품 만들기" });
    await create.getByLabel("작품 제목").fill(randomUUID());
    await create.getByLabel("첫 회차 제목").fill(randomUUID());
    await create.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "원고", exact: true });
    await editor.fill(fixture.text);
    await expect(page.getByTestId("save-state")).toHaveText("저장됨");
    const nativeWindow = await app.browserWindow(page);
    const observations = [];

    for (const theme of fixture.themes) {
      await page.getByRole("button", { name: "테마 변경", exact: true }).hover();
      await page.getByRole("group", { name: "테마 선택" })
        .getByRole("button", { name: theme.label, exact: true }).click();
      await expect(page.locator(".studio-app-shell")).toHaveAttribute("data-starlight-theme", theme.id);
      const samples = [];
      for (const boundary of ["End", "Home"]) {
        await page.getByRole("button", { name: "추가 서식 도구 열기", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "추가 서식 도구", exact: true });
        const width = dialog.getByLabel("본문 폭", { exact: true });
        const expectedValue = await width.getAttribute(boundary === "Home" ? "min" : "max");
        await width.focus();
        await width.press(boundary);
        await expect(width).toHaveValue(expectedValue!);
        await dialog.getByRole("button", { name: "추가 서식 도구 닫기", exact: true }).click();
        await expectEditorText(editor, fixture.text);
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        samples.push(await editor.evaluate((element) => {
          const rectangle = (node: Element) => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
          };
          // Find the surface the reader actually sees behind the text, regardless
          // of which element owns it. A background on the text itself must fail.
          let surface: Element | null = element;
          while (surface !== null) {
            const color = getComputedStyle(surface).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") break;
            surface = surface.parentElement;
          }
          if (surface === null) throw new Error("The manuscript has no visible background");
          return {
            content: rectangle(element),
            background: { ...rectangle(surface), color: getComputedStyle(surface).backgroundColor },
          };
        }));
        const png = await nativeWindow.evaluate(async (window) =>
          (await window.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString("base64"));
        await writeFile(test.info().outputPath(`${theme.id}-${boundary}.png`), Buffer.from(png, "base64"));
      }
      const [wide, narrow] = samples;
      expect(narrow!.content.width).toBeLessThan(wide!.content.width);
      expect(narrow!.background).toEqual(wide!.background);
      await expect(editor).toHaveCSS("border-left-width", "0px");
      await expect(editor).toHaveCSS("box-shadow", "none");
      observations.push({ theme: theme.id, wide, narrow });
    }
    await writeFile(test.info().outputPath("background-geometry.json"), JSON.stringify(observations, null, 2));
    succeeded = true;
  } finally {
    if (!succeeded) await app.evaluate(({ app: main }) => main.exit(0)).catch(() => undefined);
    await app.close().catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory);
  }
});
