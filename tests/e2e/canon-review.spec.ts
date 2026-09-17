import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  expect,
  removeVerifiedTemporaryDirectory,
  test,
} from "./support/desktop-shell-suite";

type SeedTarget = Readonly<{
  characterId: string;
  characterRevision: number;
  currentDocumentRevisionId: string;
  documentId: string;
  oldDocumentRevisionId: string;
  workId: string;
}>;

type InspectorResponse = Readonly<{
  id?: number;
  error?: Readonly<{ message: string }>;
  result?: Readonly<{
    result?: Readonly<{
      value?: unknown;
    }>;
    exceptionDetails?: unknown;
  }>;
}>;

class NodeInspectorClient {
  readonly #socket: WebSocket;
  readonly #pending = new Map<number, Readonly<{
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>>();
  #nextId = 1;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      const response = JSON.parse(String(event.data)) as InspectorResponse;
      if (response.id === undefined) return;
      const pending = this.#pending.get(response.id);
      if (pending === undefined) return;
      this.#pending.delete(response.id);
      if (response.error !== undefined || response.result?.exceptionDetails !== undefined) {
        pending.reject(new Error(response.error?.message ?? JSON.stringify(response.result?.exceptionDetails)));
      } else {
        pending.resolve(response.result?.result?.value);
      }
    });
    socket.addEventListener("close", () => {
      for (const pending of this.#pending.values()) {
        pending.reject(new Error("Electron main inspector closed"));
      }
      this.#pending.clear();
    });
  }

  static async connect(url: string): Promise<NodeInspectorClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Electron main inspector connection failed")), { once: true });
    });
    const client = new NodeInspectorClient(socket);
    await client.request("Runtime.enable", {});
    return client;
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.#socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Electron main inspector is not open"));
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, Object.freeze({ resolve, reject }));
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    return await this.request("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }) as T;
  }

  close(): void {
    this.#socket.close();
  }
}

type DirectElectronApplication = Readonly<{
  child: ChildProcess;
  inspector: NodeInspectorClient;
}>;

function attachElectronDiagnostics(child: ChildProcess): void {
  child.stdout?.on("data", (chunk: Buffer | string) => {
    process.stderr.write(`[canon-e2e electron stdout] ${String(chunk)}`);
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    process.stderr.write(`[canon-e2e electron stderr] ${String(chunk)}`);
  });
}

async function reserveLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(9229, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) =>
    error === undefined ? resolve() : reject(error)
  ));
  if (address === null || typeof address === "string") {
    throw new Error("Loopback port allocation failed");
  }
  return address.port;
}

async function launchDirectElectron(input: Readonly<{
  args: readonly string[];
  env: NodeJS.ProcessEnv;
}>): Promise<DirectElectronApplication> {
  const port = await reserveLoopbackPort();
  const child = spawn(
    path.join(process.cwd(), "node_modules", "electron", "dist", "electron.exe"),
    [...input.args],
    {
      cwd: process.cwd(),
      env: input.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  attachElectronDiagnostics(child);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
    throw new Error(`Direct Electron exited before renderer startup: ${child.exitCode}`);
  }
  (process as unknown as { _debugProcess(processId: number): void })
    ._debugProcess(child.pid);
  const deadline = Date.now() + 15_000;
  let inspectorUrl: string | null = null;
  let lastError: unknown = null;
  while (inspectorUrl === null && Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Direct Electron exited before inspector readiness: ${child.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json() as readonly Readonly<{
        webSocketDebuggerUrl?: string;
      }>[];
      inspectorUrl = targets[0]?.webSocketDebuggerUrl ?? null;
    } catch (reason) {
      lastError = reason;
    }
    if (inspectorUrl === null) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (inspectorUrl === null) {
    child.kill("SIGKILL");
    throw new Error("Direct Electron inspector readiness timed out", { cause: lastError });
  }
  const inspector = await NodeInspectorClient.connect(inspectorUrl);
  try {
    let rendererReady = false;
    let rendererReadinessError: unknown = null;
    while (!rendererReady && Date.now() < deadline) {
      try {
        rendererReady = await inspector.evaluate<boolean>(`(async () => {
          const { BrowserWindow } = process.getBuiltinModule("module")
            .createRequire(process.cwd() + "/package.json")("electron");
          const target = BrowserWindow.getAllWindows()[0];
          if (target === undefined || target.webContents.isLoading()) return false;
          return await target.webContents.executeJavaScript(
            "document.readyState === 'complete' && document.querySelector('.studio-app-shell') !== null",
            true,
          );
        })()`);
      } catch (reason) {
        rendererReadinessError = reason;
        rendererReady = false;
      }
      if (!rendererReady) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!rendererReady) {
      throw new Error("Direct Electron renderer readiness timed out", {
        cause: rendererReadinessError,
      });
    }
    await inspector.evaluate(`(() => {
      const { BrowserWindow } = process.getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("electron");
      const target = BrowserWindow.getAllWindows()[0];
      if (target === undefined) throw new Error("Electron window is unavailable");
      target.setSize(1280, 800);
      return true;
    })()`);
    return Object.freeze({ child, inspector });
  } catch (reason) {
    inspector.close();
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    throw reason;
  }
}

async function rendererEvaluate<T>(
  app: DirectElectronApplication,
  script: string,
): Promise<T> {
  return app.inspector.evaluate<T>(`(async () => {
    const { BrowserWindow } = process.getBuiltinModule("module")
      .createRequire(process.cwd() + "/package.json")("electron");
    const target = BrowserWindow.getAllWindows()[0];
    if (target === undefined) throw new Error("Electron window is unavailable");
    return await target.webContents.executeJavaScript(${JSON.stringify(script)}, true);
  })()`);
}

async function closeDirectElectron(app: DirectElectronApplication): Promise<void> {
  const exit = app.child.exitCode === null && app.child.signalCode === null
    ? once(app.child, "exit").then(() => true, () => true)
    : Promise.resolve(true);
  try {
    await app.inspector.evaluate(`(() => {
      const { BrowserWindow } = process.getBuiltinModule("module")
        .createRequire(process.cwd() + "/package.json")("electron");
      const target = BrowserWindow.getAllWindows()[0];
      setTimeout(() => target?.close(), 0);
      return true;
    })()`);
  } catch {
    // The inspector can close before the BrowserWindow close completes.
  }
  app.inspector.close();
  const closed = await Promise.race([
    exit,
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 8_000)),
  ]);
  if (!closed && app.child.exitCode === null && app.child.signalCode === null) {
    app.child.kill("SIGKILL");
    await once(app.child, "exit").catch(() => undefined);
  }
}

async function waitForRendererValue<T>(
  app: DirectElectronApplication,
  script: string,
  predicate: (value: T) => boolean,
  label: string,
): Promise<T> {
  const deadline = Date.now() + 15_000;
  let value = await rendererEvaluate<T>(app, script);
  while (!predicate(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await rendererEvaluate<T>(app, script);
  }
  if (!predicate(value)) {
    const snapshot = await rendererEvaluate<string>(
      app,
      "document.body.innerText.slice(0, 2000)",
    ).catch(() => "renderer snapshot unavailable");
    throw new Error(`Timed out waiting for ${label}: ${snapshot}`);
  }
  return value;
}

function controlScript(input: Readonly<{
  action: string;
  exact?: boolean;
  rootSelector?: string;
  selector?: string;
  text: string;
}>): string {
  return `(() => {
    const normalize = (value) => String(value ?? "").replace(/\\s+/gu, " ").trim();
    const root = ${input.rootSelector === undefined
      ? "document"
      : `document.querySelector(${JSON.stringify(input.rootSelector)})`};
    if (root === null) return false;
    const target = [...root.querySelectorAll(${JSON.stringify(input.selector ?? "button")})]
      .find((entry) => ${input.exact === false
        ? `normalize(entry.textContent).includes(${JSON.stringify(input.text)})`
        : `normalize(entry.textContent) === ${JSON.stringify(input.text)}`});
    if (!(target instanceof HTMLElement)) return false;
    ${input.action}
    return true;
  })()`;
}

async function clickControl(
  app: DirectElectronApplication,
  text: string,
  options: Readonly<{
    exact?: boolean;
    rootSelector?: string;
    selector?: string;
  }> = {},
): Promise<void> {
  await waitForRendererValue(
    app,
    controlScript({ action: "target.click();", text, ...options }),
    Boolean,
    `control ${text}`,
  );
}

async function focusControl(
  app: DirectElectronApplication,
  text: string,
  options: Readonly<{
    exact?: boolean;
    rootSelector?: string;
    selector?: string;
  }> = {},
): Promise<void> {
  await waitForRendererValue(
    app,
    controlScript({ action: "target.focus();", text, ...options }),
    Boolean,
    `focus ${text}`,
  );
}

async function fillLabeledControl(
  app: DirectElectronApplication,
  labelText: string,
  value: string,
): Promise<void> {
  const script = `(() => {
    const normalize = (input) => String(input ?? "").replace(/\\s+/gu, " ").trim();
    const label = [...document.querySelectorAll("label")]
      .find((entry) => normalize(entry.textContent).includes(${JSON.stringify(labelText)}));
    const control = label?.control ?? label?.querySelector("input, textarea, select");
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return false;
    const prototype = control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : control instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(control, ${JSON.stringify(value)});
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`;
  await waitForRendererValue(app, script, Boolean, `labeled control ${labelText}`);
}

async function sendKey(
  app: DirectElectronApplication,
  keyCode: string,
  modifiers: readonly string[] = [],
): Promise<void> {
  await app.inspector.evaluate(`(() => {
    const { BrowserWindow } = process.getBuiltinModule("module")
      .createRequire(process.cwd() + "/package.json")("electron");
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    if (contents === undefined) throw new Error("Electron contents unavailable");
    contents.sendInputEvent({ type: "keyDown", keyCode: ${JSON.stringify(keyCode)}, modifiers: ${JSON.stringify(modifiers)} });
    contents.sendInputEvent({ type: "keyUp", keyCode: ${JSON.stringify(keyCode)}, modifiers: ${JSON.stringify(modifiers)} });
    return true;
  })()`);
}

async function insertFocusedText(
  app: DirectElectronApplication,
  text: string,
): Promise<void> {
  await app.inspector.evaluate(`(() => {
    const { BrowserWindow } = process.getBuiltinModule("module")
      .createRequire(process.cwd() + "/package.json")("electron");
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    if (contents === undefined) throw new Error("Electron contents unavailable");
    contents.insertText(${JSON.stringify(text)});
    return true;
  })()`);
}

async function waitForText(
  app: DirectElectronApplication,
  text: string,
  rootSelector = "body",
): Promise<void> {
  await waitForRendererValue(
    app,
    `document.querySelector(${JSON.stringify(rootSelector)})?.textContent?.includes(${JSON.stringify(text)}) === true`,
    Boolean,
    `text ${text}`,
  );
}

async function openStoredWorkspace(app: DirectElectronApplication): Promise<void> {
  await waitForRendererValue(
    app,
    controlScript({
      action: "target.click();",
      exact: false,
      selector: "button",
      text: "이어쓰기",
    }),
    Boolean,
    "stored workspace action",
  );
  await waitForRendererValue(
    app,
    `document.querySelector('[role="textbox"][aria-label="원고"]') !== null`,
    Boolean,
    "manuscript editor",
  );
}

async function focusSelector(
  app: DirectElectronApplication,
  selector: string,
): Promise<void> {
  await waitForRendererValue(
    app,
    `(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (!(target instanceof HTMLElement)) return false; target.focus(); return true; })()`,
    Boolean,
    `focus selector ${selector}`,
  );
}

async function clickSelector(
  app: DirectElectronApplication,
  selector: string,
): Promise<void> {
  await waitForRendererValue(
    app,
    `(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (!(target instanceof HTMLElement)) return false; target.click(); return true; })()`,
    Boolean,
    `click selector ${selector}`,
  );
}

function seedCanonReviewCandidates(input: Readonly<{
  databasePath: string;
  currentText: string;
  initialText: string;
  initialRole: string;
  initialSummary: string;
  roleProposal: string;
  summaryProposal: string;
  target: SeedTarget;
}>) {
  const database = new DatabaseSync(input.databasePath);
  const now = new Date("2026-08-29T01:00:00.000Z");
  const seed = (
    label: string,
    sourceDocumentRevisionId: string,
    sourceText: string,
    fields: readonly Readonly<{
      field: string;
      before: unknown;
      after: unknown;
      selected: boolean;
    }>[],
    secondOffset: number,
  ) => {
    const candidateId = randomUUID();
    const itemId = randomUUID();
    const receiptId = randomUUID();
    const createdAt = new Date(now.getTime() + secondOffset * 1_000).toISOString();
    const sourceRange = [{
      documentId: input.target.documentId,
      documentRevisionId: sourceDocumentRevisionId,
      from: 0,
      to: sourceText.length,
    }];
    database.prepare(`
      INSERT INTO assistant_context_receipts (
        id, schema_version, request_id, work_id, conversation_id,
        capability, destination_id, read_ranges_json,
        transmitted_ranges_json, read_character_count,
        transmitted_character_count, grant_ids_json, created_at
      ) VALUES (?, 1, ?, ?, ?, 'canon.review', ?, ?, ?, ?, ?, '[]', ?)
    `).run(
      receiptId,
      randomUUID(),
      input.target.workId,
      randomUUID(),
      "e2e-fixture",
      JSON.stringify(sourceRange),
      JSON.stringify(sourceRange),
      sourceText.length,
      sourceText.length,
      createdAt,
    );
    database.prepare(`
      INSERT INTO assistant_canon_review_candidates (
        id, schema_version, revision, created_at, updated_at, retired_at,
        request_id, work_id, source_document_id, source_document_revision_id,
        source_from, source_to, provider_id, model_id, prompt_version,
        context_receipt_id, status
      ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'ready')
    `).run(
      candidateId,
      createdAt,
      createdAt,
      randomUUID(),
      input.target.workId,
      input.target.documentId,
      sourceDocumentRevisionId,
      sourceText.length,
      "e2e-provider",
      "e2e-model",
      "eum-canon-review-v1",
      receiptId,
    );
    database.prepare(`
      INSERT INTO assistant_canon_review_items (
        id, schema_version, work_id, candidate_id, target_kind, operation,
        target_hint, target_id, matching_target_ids_json,
        expected_target_revision, assertion_basis, reason, status,
        applied_target_id, created_at, updated_at
      ) VALUES (?, 1, ?, ?, 'character', 'update', ?, ?, ?, ?,
        'explicit-evidence', ?, 'pending', NULL, ?, ?)
    `).run(
      itemId,
      input.target.workId,
      candidateId,
      label,
      input.target.characterId,
      JSON.stringify([input.target.characterId]),
      input.target.characterRevision,
      `${label}의 원문 직접 서술`,
      createdAt,
      createdAt,
    );
    const fieldStatement = database.prepare(`
      INSERT INTO assistant_canon_review_field_changes (
        work_id, candidate_id, item_id, field_name, before_json,
        after_json, selected, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    fields.forEach((field, index) => {
      fieldStatement.run(
        input.target.workId,
        candidateId,
        itemId,
        field.field,
        JSON.stringify(field.before),
        JSON.stringify(field.after),
        field.selected ? 1 : 0,
        index,
      );
    });
    database.prepare(`
      INSERT INTO assistant_canon_review_evidence (
        id, schema_version, work_id, candidate_id, item_id,
        source_document_id, source_document_revision_id, source_from,
        source_to, exact_text, anchor_id, order_index
      ) VALUES (?, 1, ?, ?, ?, ?, ?, 0, ?, ?, NULL, 0)
    `).run(
      randomUUID(),
      input.target.workId,
      candidateId,
      itemId,
      input.target.documentId,
      sourceDocumentRevisionId,
      sourceText.length,
      sourceText,
    );
  };
  try {
    database.exec("PRAGMA foreign_keys = ON");
    database.exec("BEGIN IMMEDIATE");
    seed("원문 stale 후보", input.target.oldDocumentRevisionId, input.initialText, [{
      field: "summary",
      before: input.initialSummary,
      after: "과거 원문에서 만든 요약",
      selected: true,
    }], 1);
    seed("대상 stale 후보", input.target.currentDocumentRevisionId, input.currentText, [{
      field: "note",
      before: "",
      after: "이미 바뀐 인물에 적용하면 안 되는 메모",
      selected: true,
    }], 2);
    seed("성공 후보", input.target.currentDocumentRevisionId, input.currentText, [
      {
        field: "role",
        before: input.initialRole,
        after: input.roleProposal,
        selected: true,
      },
      {
        field: "summary",
        before: input.initialSummary,
        after: input.summaryProposal,
        selected: true,
      },
    ], 3);
    database.exec("COMMIT");
  } catch (reason) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw reason;
  } finally {
    database.close();
  }
}

function seedApprovedRelationEvidence(input: Readonly<{
  characterName: string;
  currentText: string;
  databasePath: string;
  target: SeedTarget;
}>): Readonly<{ label: string; relationId: string }> {
  const database = new DatabaseSync(input.databasePath);
  const candidateId = randomUUID();
  const itemId = randomUUID();
  const relationId = randomUUID();
  const secondCharacterId = randomUUID();
  const secondCharacterName = `민호 ${randomUUID().slice(0, 8)}`;
  const label = `${input.characterName} → ${secondCharacterName}`;
  const createdAt = "2026-08-29T02:00:00.000Z";
  try {
    database.exec("PRAGMA foreign_keys = ON");
    const approvedSource = database.prepare(`
      SELECT
        e.anchor_id AS anchorId,
        c.context_receipt_id AS contextReceiptId
      FROM assistant_canon_review_candidates c
      JOIN assistant_canon_review_items i
        ON i.work_id = c.work_id AND i.candidate_id = c.id
      JOIN assistant_canon_review_evidence e
        ON e.work_id = i.work_id AND e.candidate_id = i.candidate_id AND e.item_id = i.id
      WHERE c.work_id = ? AND i.target_hint = '성공 후보'
        AND i.status = 'approved' AND e.anchor_id IS NOT NULL
    `).get(input.target.workId) as Record<string, unknown> | undefined;
    if (approvedSource === undefined) {
      throw new Error("Approved Character evidence is unavailable for relation fixture");
    }
    const anchorId = String(approvedSource.anchorId);
    const contextReceiptId = String(approvedSource.contextReceiptId);

    database.exec("BEGIN IMMEDIATE");
    database.prepare(`
      INSERT INTO characters (
        id, schema_version, revision, created_at, updated_at, retired_at,
        work_id, name, aliases_json, role, summary, appearance,
        personality, speech, goal, conflict, note
      ) VALUES (?, 1, 1, ?, ?, NULL, ?, ?, '[]', '', '', '', '', '', '', '', '')
    `).run(
      secondCharacterId,
      createdAt,
      createdAt,
      input.target.workId,
      secondCharacterName,
    );
    database.prepare(`
      INSERT INTO character_relations (
        id, schema_version, revision, created_at, updated_at, retired_at,
        retirement_reason, work_id, from_character_id, to_character_id,
        kind, description
      ) VALUES (?, 1, 1, ?, ?, NULL, NULL, ?, ?, ?, '동료', '같은 기록 임무를 맡는다.')
    `).run(
      relationId,
      createdAt,
      createdAt,
      input.target.workId,
      input.target.characterId,
      secondCharacterId,
    );
    database.prepare(`
      INSERT INTO assistant_canon_review_candidates (
        id, schema_version, revision, created_at, updated_at, retired_at,
        request_id, work_id, source_document_id, source_document_revision_id,
        source_from, source_to, provider_id, model_id, prompt_version,
        context_receipt_id, status
      ) VALUES (?, 1, 2, ?, ?, NULL, ?, ?, ?, ?, 0, ?,
        'e2e-provider', 'e2e-model', 'eum-canon-review-v1', ?, 'completed')
    `).run(
      candidateId,
      createdAt,
      createdAt,
      randomUUID(),
      input.target.workId,
      input.target.documentId,
      input.target.currentDocumentRevisionId,
      input.currentText.length,
      contextReceiptId,
    );
    database.prepare(`
      INSERT INTO assistant_canon_review_items (
        id, schema_version, work_id, candidate_id, target_kind, operation,
        target_hint, target_id, matching_target_ids_json,
        expected_target_revision, assertion_basis, reason, status,
        applied_target_id, created_at, updated_at
      ) VALUES (?, 1, ?, ?, 'character-relation', 'create', '관계 근거 후보',
        NULL, '[]', NULL, 'explicit-evidence', '관계가 원문에 직접 확인된다.',
        'approved', ?, ?, ?)
    `).run(
      itemId,
      input.target.workId,
      candidateId,
      relationId,
      createdAt,
      createdAt,
    );
    const fieldStatement = database.prepare(`
      INSERT INTO assistant_canon_review_field_changes (
        work_id, candidate_id, item_id, field_name, before_json,
        after_json, selected, order_index
      ) VALUES (?, ?, ?, ?, 'null', ?, 1, ?)
    `);
    const relationFields: readonly (readonly [string, string])[] = [
      ["fromCharacterId", input.target.characterId],
      ["toCharacterId", secondCharacterId],
      ["kind", "동료"],
      ["description", "같은 기록 임무를 맡는다."],
    ];
    relationFields.forEach(([field, value], index) => fieldStatement.run(
      input.target.workId,
      candidateId,
      itemId,
      field,
      JSON.stringify(value),
      index,
    ));
    database.prepare(`
      INSERT INTO assistant_canon_review_evidence (
        id, schema_version, work_id, candidate_id, item_id,
        source_document_id, source_document_revision_id, source_from,
        source_to, exact_text, anchor_id, order_index
      ) VALUES (?, 1, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0)
    `).run(
      randomUUID(),
      input.target.workId,
      candidateId,
      itemId,
      input.target.documentId,
      input.target.currentDocumentRevisionId,
      input.currentText.length,
      input.currentText,
      anchorId,
    );
    database.prepare(`
      INSERT INTO assistant_canon_review_decision_receipts (
        id, schema_version, work_id, candidate_id, item_id, decision, outcome,
        target_kind, target_id, target_revision_before, target_revision_after,
        selected_fields_json, source_document_revision_id, created_at
      ) VALUES (?, 1, ?, ?, ?, 'approve', 'applied', 'character-relation', ?,
        NULL, 1, ?, ?, ?)
    `).run(
      randomUUID(),
      input.target.workId,
      candidateId,
      itemId,
      relationId,
      JSON.stringify(["fromCharacterId", "toCharacterId", "kind", "description"]),
      input.target.currentDocumentRevisionId,
      createdAt,
    );
    database.exec("COMMIT");
    return Object.freeze({ label, relationId });
  } catch (reason) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw reason;
  } finally {
    database.close();
  }
}

test("reviews an exact manuscript selection and preserves a partial Character update across restart", async () => {
  test.setTimeout(180_000);
  const directory = await mkdtemp(path.join(tmpdir(), "eum-canon-review-e2e-"));
  const workTitle = `별빛 작품 ${randomUUID().slice(0, 8)}`;
  const documentTitle = `별빛 회차 ${randomUUID().slice(0, 8)}`;
  const characterName = `윤서 ${randomUUID().slice(0, 8)}`;
  const initialRole = "기록 수습생";
  const initialSummary = "밤의 기록을 모은다.";
  const roleProposal = "기록관";
  const finalRole = "야간 기록관";
  const summaryProposal = "승인하지 않을 요약";
  const initialText = "윤서는 달빛 아래에서 낡은 기록을 펼쳤다.";
  const suffix = " 그리고 새 표식을 남겼다.";
  const currentText = `${initialText}${suffix}`;
  const runtimeEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    EUM_STUDIO_TEST_EPHEMERAL_WORKSPACE: "0",
    EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH: directory,
    EUM_STUDIO_WINDOW_VISIBILITY: "visible",
    EUM_STUDIO_HARDWARE_ACCELERATION: "disabled",
    EUM_STUDIO_DISABLE_SANDBOX: "1",
  };
  delete runtimeEnvironment.NODE_OPTIONS;
  delete runtimeEnvironment.ELECTRON_RUN_AS_NODE;
  const electronArguments = [
    ".",
    `--user-data-dir=${path.join(directory, "electron-user-data")}`,
  ];
  let electronApp = await launchDirectElectron({
    args: electronArguments,
    env: runtimeEnvironment,
  });

  try {
    await clickControl(electronApp, "새 작품");
    await fillLabeledControl(electronApp, "작품 제목", workTitle);
    await fillLabeledControl(electronApp, "첫 회차 제목", documentTitle);
    await clickControl(electronApp, "작품 만들기");
    await waitForText(electronApp, workTitle);

    await clickControl(electronApp, "구조");
    await clickControl(electronApp, "인물", { selector: '[role="tab"]' });
    await fillLabeledControl(electronApp, "인물 이름", characterName);
    await fillLabeledControl(electronApp, "역할", initialRole);
    await fillLabeledControl(electronApp, "인물 요약", initialSummary);
    await clickControl(electronApp, "인물 만들기");
    await waitForText(electronApp, characterName, '[aria-label="인물 작업면"]');

    await clickControl(electronApp, "쓰기");
    const manuscriptSelector = '[role="textbox"][aria-label="원고"]';
    await focusSelector(electronApp, manuscriptSelector);
    await insertFocusedText(electronApp, initialText);
    await waitForRendererValue(
      electronApp,
      `document.querySelector(${JSON.stringify(manuscriptSelector)})?.textContent === ${JSON.stringify(initialText)}`,
      Boolean,
      "initial manuscript text",
    );
    await clickSelector(electronApp, '[data-testid="manuscript-title"]');
    await waitForRendererValue(
      electronApp,
      `document.querySelector('[data-testid="save-state"]')?.textContent?.trim() === "저장됨"`,
      Boolean,
      "initial durable save",
    );
    await focusSelector(electronApp, manuscriptSelector);
    await sendKey(electronApp, "End", ["control"]);
    await insertFocusedText(electronApp, suffix);
    await clickSelector(electronApp, '[data-testid="manuscript-title"]');
    await waitForRendererValue(
      electronApp,
      `document.querySelector(${JSON.stringify(manuscriptSelector)})?.textContent === ${JSON.stringify(currentText)} && document.querySelector('[data-testid="save-state"]')?.textContent?.trim() === "저장됨"`,
      Boolean,
      "current manuscript save",
    );

    await focusSelector(electronApp, manuscriptSelector);
    await sendKey(electronApp, "A", ["control"]);
    await rendererEvaluate(electronApp, `(() => {
      const target = document.querySelector(${JSON.stringify(manuscriptSelector)});
      if (!(target instanceof HTMLElement)) return false;
      const rectangle = target.getBoundingClientRect();
      target.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons: 2,
        clientX: rectangle.left + 24,
        clientY: rectangle.top + 24,
      }));
      return true;
    })()`);
    await waitForRendererValue(
      electronApp,
      `document.querySelector('.manuscript-context-menu button') !== null`,
      Boolean,
      "manuscript context menu",
    );
    await clickControl(electronApp, "별빛 변경 점검", {
      rootSelector: ".manuscript-context-menu",
    });
    await waitForText(
      electronApp,
      "별빛 변경 점검을 사용하려면 조수 연결이 필요합니다.",
      '[aria-label="별빛 작업"]',
    );

    await closeDirectElectron(electronApp);
    const databasePath = path.join(directory, "workspace.sqlite3");
    const database = new DatabaseSync(databasePath, { readOnly: true });
    let target: SeedTarget;
    try {
      const row = database.prepare(`
        SELECT
          w.id AS workId,
          d.id AS documentId,
          m.current_revision_id AS currentDocumentRevisionId,
          c.id AS characterId,
          c.revision AS characterRevision
        FROM works w
        JOIN documents d ON d.work_id = w.id
        JOIN manuscripts m ON m.work_id = w.id AND m.document_id = d.id
        JOIN characters c ON c.work_id = w.id
        WHERE w.title = ? AND d.title = ? AND c.name = ?
      `).get(workTitle, documentTitle, characterName) as Record<string, unknown>;
      const workId = String(row.workId);
      const documentId = String(row.documentId);
      const currentDocumentRevisionId = String(row.currentDocumentRevisionId);
      const oldRevision = database.prepare(`
        SELECT id FROM document_revisions
        WHERE work_id = ? AND document_id = ? AND id <> ?
        ORDER BY rowid DESC LIMIT 1
      `).get(workId, documentId, currentDocumentRevisionId) as
        Record<string, unknown>;
      target = {
        workId,
        documentId,
        currentDocumentRevisionId,
        oldDocumentRevisionId: String(oldRevision.id),
        characterId: String(row.characterId),
        characterRevision: Number(row.characterRevision),
      };
    } finally {
      database.close();
    }
    seedCanonReviewCandidates({
      databasePath,
      currentText,
      initialText,
      initialRole,
      initialSummary,
      roleProposal,
      summaryProposal,
      target,
    });

    electronApp = await launchDirectElectron({
      args: electronArguments,
      env: runtimeEnvironment,
    });
    await openStoredWorkspace(electronApp);
    await clickControl(electronApp, "별빛");
    await clickControl(electronApp, "변경 검토", { selector: '[role="tab"]' });
    const layout = await waitForRendererValue<{
      bottom: number;
      columns: number;
      right: number;
      viewportHeight: number;
      viewportWidth: number;
    } | null>(electronApp, `(() => {
      const grid = document.querySelector('.canon-review-grid');
      if (!(grid instanceof HTMLElement)) return null;
      const rect = grid.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
        right: rect.right,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
      };
    })()`, (value) => value !== null, "canon review layout");
    if (layout === null) throw new Error("Canon review layout is unavailable");
    expect(layout.columns).toBe(3);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);

    const selectCandidate = async (label: string) => {
      await clickControl(electronApp, label, {
        exact: false,
        selector: ".canon-candidate-list > li > button",
      });
      await clickControl(electronApp, label, {
        exact: false,
        selector: ".canon-item-list button",
      });
    };
    await selectCandidate("성공 후보");
    await waitForRendererValue(electronApp, `(() => {
      const item = [...document.querySelectorAll('.canon-field-change')]
        .find((entry) => entry.textContent?.includes('요약'));
      const checkbox = item?.querySelector('input[type="checkbox"]');
      if (!(checkbox instanceof HTMLInputElement) || checkbox.disabled) return false;
      checkbox.focus();
      return true;
    })()`, Boolean, "summary checkbox focus");
    await sendKey(electronApp, "Space");
    await waitForRendererValue(
      electronApp,
      `(() => { const item = [...document.querySelectorAll('.canon-field-change')].find((entry) => entry.textContent?.includes('요약')); const checkbox = item?.querySelector('input[type="checkbox"]'); return checkbox instanceof HTMLInputElement && !checkbox.checked; })()`,
      Boolean,
      "summary field deselection",
    );
    await waitForRendererValue(electronApp, `(() => {
      const item = [...document.querySelectorAll('.canon-field-change')]
        .find((entry) => entry.textContent?.includes('역할'));
      const editor = item?.querySelector('textarea');
      if (!(editor instanceof HTMLTextAreaElement) || editor.disabled) return false;
      editor.focus();
      return true;
    })()`, Boolean, "role editor focus");
    await sendKey(electronApp, "A", ["control"]);
    await insertFocusedText(electronApp, finalRole);
    await waitForRendererValue(electronApp, `(() => {
      const item = [...document.querySelectorAll('.canon-field-change')]
        .find((entry) => entry.textContent?.includes('역할'));
      const button = [...(item?.querySelectorAll('button') ?? [])]
        .find((entry) => entry.textContent?.trim() === '수정값 저장');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.focus();
      return true;
    })()`, Boolean, "role save action");
    await rendererEvaluate(electronApp, `(() => {
      const item = [...document.querySelectorAll('.canon-field-change')]
        .find((entry) => entry.textContent?.includes('역할'));
      const button = [...(item?.querySelectorAll('button') ?? [])]
        .find((entry) => entry.textContent?.trim() === '수정값 저장');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    await waitForRendererValue(electronApp, `(() => {
      const button = [...document.querySelectorAll('.canon-diff-column button')]
        .find((entry) => entry.textContent?.trim() === '승인');
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.focus();
      return true;
    })()`, Boolean, "approval action");
    await clickControl(electronApp, "승인", { rootSelector: ".canon-diff-column" });
    await waitForText(electronApp, "선택한 변경을 별빛에 반영했습니다.", '[aria-label="별빛 작업"]');

    await selectCandidate("대상 stale 후보");
    await clickControl(electronApp, "승인", { rootSelector: ".canon-diff-column" });
    await waitForText(electronApp, "별빛 대상이 변경되어 반영하지 않았습니다.", '[aria-label="별빛 작업"]');
    await selectCandidate("원문 stale 후보");
    await clickControl(electronApp, "승인", { rootSelector: ".canon-diff-column" });
    await waitForText(electronApp, "근거 원문의 저장 버전이 달라져 반영하지 않았습니다.", '[aria-label="별빛 작업"]');

    await clickControl(electronApp, "별빛", { selector: '[role="tab"]' });
    await waitForText(electronApp, characterName, '[aria-label="별빛 작업"]');
    await waitForText(electronApp, finalRole, '[aria-label="별빛 작업"]');
    await waitForText(electronApp, initialSummary, '[aria-label="별빛 작업"]');
    await waitForText(electronApp, currentText, '[aria-label="별빛 원문 근거"]');
    await focusControl(electronApp, "원문 열기", {
      rootSelector: '[aria-label="별빛 원문 근거"]',
    });
    await clickControl(electronApp, "원문 열기", {
      rootSelector: '[aria-label="별빛 원문 근거"]',
    });
    await waitForRendererValue(
      electronApp,
      `window.getSelection()?.toString() === ${JSON.stringify(currentText)}`,
      Boolean,
      "exact canon evidence selection",
    );
    await clickControl(electronApp, "별빛으로 돌아가기");
    await waitForRendererValue(
      electronApp,
      `document.querySelector('[aria-label="별빛 작업"]') !== null`,
      Boolean,
      "returned canon workspace",
    );

    await closeDirectElectron(electronApp);
    const approvedRelation = seedApprovedRelationEvidence({
      characterName,
      currentText,
      databasePath,
      target,
    });
    electronApp = await launchDirectElectron({
      args: electronArguments,
      env: runtimeEnvironment,
    });
    await openStoredWorkspace(electronApp);
    await clickControl(electronApp, "별빛");
    await clickControl(electronApp, characterName, {
      exact: false,
      selector: ".canon-browser-list button",
    });
    await waitForText(electronApp, characterName, '[aria-label="별빛 작업"]');
    await waitForText(electronApp, finalRole, '[aria-label="별빛 작업"]');
    await waitForText(electronApp, initialSummary, '[aria-label="별빛 작업"]');
    await clickControl(electronApp, approvedRelation.label, {
      exact: false,
      selector: ".canon-browser-list button",
    });
    await waitForText(electronApp, currentText, '[aria-label="별빛 원문 근거"]');
    await clickControl(electronApp, "원문 열기", {
      rootSelector: '[aria-label="별빛 원문 근거"]',
    });
    await waitForRendererValue(
      electronApp,
      `window.getSelection()?.toString() === ${JSON.stringify(currentText)}`,
      Boolean,
      "exact relation evidence selection after restart",
    );

    await closeDirectElectron(electronApp);
    const finalDatabase = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const storedCharacter = finalDatabase.prepare(`
        SELECT role, summary, revision FROM characters WHERE id = ?
      `).get(target.characterId) as Record<string, unknown>;
      expect(storedCharacter).toMatchObject({
        role: finalRole,
        summary: initialSummary,
        revision: target.characterRevision + 1,
      });
      const statuses = finalDatabase.prepare(`
        SELECT i.target_hint AS label, i.status, c.status AS candidateStatus
        FROM assistant_canon_review_items i
        JOIN assistant_canon_review_candidates c ON c.id = i.candidate_id
        ORDER BY i.target_hint
      `).all() as readonly Record<string, unknown>[];
      expect(statuses).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "성공 후보", status: "approved", candidateStatus: "completed" }),
        expect.objectContaining({ label: "대상 stale 후보", status: "pending", candidateStatus: "stale" }),
        expect.objectContaining({ label: "원문 stale 후보", status: "pending", candidateStatus: "stale" }),
        expect.objectContaining({ label: "관계 근거 후보", status: "approved", candidateStatus: "completed" }),
      ]));
      expect(Number(finalDatabase.prepare(`
        SELECT COUNT(*) AS count FROM assistant_canon_review_decision_receipts
      `).get()!.count)).toBe(2);
      expect(Number(finalDatabase.prepare(`
        SELECT COUNT(*) AS count FROM character_evidence WHERE character_id = ?
      `).get(target.characterId)!.count)).toBe(1);
      expect(Number(finalDatabase.prepare(`
        SELECT COUNT(*) AS count FROM character_relations WHERE id = ?
      `).get(approvedRelation.relationId)!.count)).toBe(1);
    } finally {
      finalDatabase.close();
    }
  } finally {
    await closeDirectElectron(electronApp).catch(() => undefined);
    await removeVerifiedTemporaryDirectory(directory).catch((reason) => {
      process.stderr.write(`[canon-e2e cleanup] ${String(reason)}\n`);
    });
  }
});
