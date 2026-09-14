import { once } from "node:events";
import type { ServerResponse } from "node:http";
import {
  randomUUID, readFileSync, mkdtemp, tmpdir, createServer, path,
  expect, test, electron, openAssistantContext, openStudioWorkspace, removeVerifiedTemporaryDirectory,
} from "./support/desktop-shell-suite";

test("structured HTTP UI cancels, times out, bounds chunked responses and persists only an explicit successful retry", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-structured-http-lifetime-"));
  const workspaceRoot = path.join(directory, "workspace");
  const connectionLabel = randomUUID();
  const model = randomUUID();
  const suggestion = randomUUID();
  const lateSuggestion = randomUUID();
  const policy = { timeoutMs: 5000, maxResponseBytes: 1024 };
  const connectorProfile = JSON.parse(readFileSync(path.join(process.cwd(), "config", "assistant-connectors.json"), "utf8")) as { connectors: { connectorKind: string; requestPolicy?: typeof policy }[] };
  const connector = connectorProfile.connectors.find((entry) => entry.connectorKind === "eum-structured-json-v1");
  if (!connector) throw new Error("Structured HTTP connector is not configured");
  connector.requestPolicy = policy;
  let mode: "silent" | "oversized" | "invalid" | "server-error" | "success" = "silent";
  const responses: ServerResponse[] = [];
  const closed: boolean[] = [];
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      const index = responses.length;
      responses.push(response); closed.push(false);
      response.on("close", () => { closed[index] = true; });
      if (mode === "silent") return;
      if (mode === "server-error") { response.writeHead(503); response.end("private error body"); return; }
      response.writeHead(200, { "Content-Type": "application/json" });
      if (mode === "oversized") {
        response.write(Buffer.alloc(policy.maxResponseBytes, 32));
        response.write(Buffer.alloc(1, 32));
        return; // Deliberately never end: the byte limit must terminate the stream.
      }
      if (mode === "invalid") { response.end("private invalid response"); return; }
      response.end(JSON.stringify({ schemaVersion: 1, payload: { suggestions: [{ word: suggestion, nuance: "", example: "" }], note: "" } }));
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Loopback server did not open a TCP listener");
  const env = {
    ...process.env, EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: workspaceRoot,
    EUM_STUDIO_ASSISTANT_CONNECTION_ROOT_PATH: path.join(directory, "connections"),
    EUM_STUDIO_ASSISTANT_CONNECTOR_PROFILE: JSON.stringify(connectorProfile),
    EUM_STUDIO_WINDOW_VISIBILITY: "hidden",
  };
  const args = [".", `--user-data-dir=${path.join(directory, "user-data")}`];
  let app = await electron.launch({ args, cwd: process.cwd(), env });
  try {
    let page = await app.firstWindow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "작품 만들기", exact: true }).click();
    const createWork = page.getByRole("dialog", { name: "새 작품 만들기" });
    await createWork.getByLabel("작품 제목").fill(randomUUID());
    await createWork.getByLabel("첫 회차 제목").fill(randomUUID());
    await createWork.getByRole("button", { name: "작품 만들기", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "원고" })).toBeVisible();
    let dialog = await openAssistantContext(page);
    await dialog.getByRole("button", { name: "연결 설정", exact: true }).click();
    const connections = page.getByRole("dialog", { name: "조수 연결" });
    await connections.getByRole("button", { name: "새 연결", exact: true }).first().click();
    await connections.getByLabel("연결 종류").selectOption("eum-structured-json-v1");
    await connections.getByLabel("연결 이름").fill(connectionLabel);
    await connections.getByLabel("Endpoint").fill(`http://127.0.0.1:${address.port}/assistant`);
    await connections.getByLabel("Model").fill(model);
    await connections.getByRole("button", { name: "저장", exact: true }).click();
    await expect(connections.getByRole("button", { name: /자격 증명 없음/u })).toContainText(connectionLabel);
    await connections.getByRole("button", { name: "닫기", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "조수 접근 권한" });
    await dialog.getByLabel("어휘 제안 질문").fill(randomUUID());
    const run = dialog.getByRole("button", { name: "제안 받기", exact: true });
    await run.click();
    await expect.poll(() => responses.length).toBe(1);
    await dialog.getByRole("button", { name: "요청 취소", exact: true }).click();
    await expect(dialog.getByText("조수 요청을 취소했습니다.", { exact: true })).toBeVisible();
    await expect.poll(() => closed[0]).toBe(true);
    responses[0]!.end(JSON.stringify({ schemaVersion: 1, payload: { suggestions: [{ word: lateSuggestion, nuance: "", example: "" }], note: "" } }));
    await expect(dialog.getByText(lateSuggestion, { exact: true })).toHaveCount(0);
    await expect(run).toBeEnabled();
    expect(responses).toHaveLength(1); // Cancellation does not schedule a retry.

    const start = performance.now();
    await run.click();
    await expect(dialog.getByText("조수 요청의 제한 시간이 지났습니다.", { exact: true })).toBeVisible({ timeout: policy.timeoutMs * 2 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(policy.timeoutMs);
    expect(elapsed).toBeLessThan(policy.timeoutMs * 2);
    await expect.poll(() => closed[1]).toBe(true);

    for (const [nextMode, message] of [
      ["oversized", "조수 응답이 연결에 설정된 크기 제한을 초과했습니다."],
      ["invalid", "조수 응답이 필요한 형식과 일치하지 않습니다."],
      ["server-error", "조수 서버가 요청을 처리하지 못했습니다."],
    ] as const) {
      mode = nextMode; await run.click();
      await expect(dialog.getByText(message, { exact: true })).toBeVisible();
    }
    const candidateCount = await page.evaluate(async () => {
      const profile = await window.eumStudio.editor.getManuscriptDocumentProfile();
      const document = profile.documents.find((entry) => entry.documentId === profile.initialDocumentId);
      if (!document) throw new Error("Active document missing");
      const state = await window.eumStudio.assistant.listContextState({ schemaVersion: 1, workId: document.workId, conversationId: crypto.randomUUID() as never });
      return state.vocabularySuggestionCandidates.length;
    });
    expect(candidateCount).toBe(0);
    expect(responses).toHaveLength(5);
    mode = "success"; await run.click();
    await expect(dialog.getByText(suggestion, { exact: true })).toBeVisible();
    expect(responses).toHaveLength(6);
    await dialog.getByRole("button", { name: "조수 접근 권한 닫기", exact: true }).click();
    await app.close();
    app = await electron.launch({ args, cwd: process.cwd(), env });
    page = await openStudioWorkspace(app);
    dialog = await openAssistantContext(page);
    await expect(dialog.getByText(suggestion, { exact: true })).toBeVisible();
    await expect(dialog.getByText(lateSuggestion, { exact: true })).toHaveCount(0);
    expect(responses).toHaveLength(6);
  } finally {
    await app.close(); server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await removeVerifiedTemporaryDirectory(directory);
  }
});
