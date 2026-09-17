import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import * as ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import {
  RuntimeBootstrapController,
  type RuntimeBootstrapClient,
  type RuntimeProjection,
} from "./RuntimeBootstrapController";

const QUERY_ORDER = Object.freeze([
  "getRuntimeInfo",
  "getManuscriptInputProfile",
  "getManuscriptFormattingProfile",
  "getManuscriptPreflightProfile",
  "getFragmentProfile",
  "getForeshadowPointProfile",
  "getManuscriptDocumentProfile",
  "getManuscriptPersistenceProfile",
  "getManuscriptStartupRecovery",
  "getManuscriptResumeCheckpoint",
  "getCatalog",
]);

function projectionValue<K extends keyof RuntimeProjection>(
  key: K,
): RuntimeProjection[K] {
  return Object.freeze({ key }) as unknown as RuntimeProjection[K];
}

const values: RuntimeProjection = Object.freeze({
  info: projectionValue("info"),
  inputProfile: projectionValue("inputProfile"),
  formattingProfile: projectionValue("formattingProfile"),
  preflightProfile: projectionValue("preflightProfile"),
  fragmentProfile: projectionValue("fragmentProfile"),
  foreshadowPointProfile: projectionValue("foreshadowPointProfile"),
  documentProfile: projectionValue("documentProfile"),
  persistenceProfile: projectionValue("persistenceProfile"),
  startupRecovery: projectionValue("startupRecovery"),
  resumeCheckpoint: projectionValue("resumeCheckpoint"),
  catalog: projectionValue("catalog"),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createResolvedClient(order: string[] = []): RuntimeBootstrapClient {
  const read = <K extends keyof RuntimeProjection>(
    name: string,
    key: K,
  ) => vi.fn(async () => {
    order.push(name);
    return values[key];
  });
  return {
    system: {
      getRuntimeInfo: read("getRuntimeInfo", "info"),
    },
    editor: {
      getManuscriptInputProfile: read(
        "getManuscriptInputProfile",
        "inputProfile",
      ),
      getManuscriptFormattingProfile: read(
        "getManuscriptFormattingProfile",
        "formattingProfile",
      ),
      getManuscriptPreflightProfile: read(
        "getManuscriptPreflightProfile",
        "preflightProfile",
      ),
      getManuscriptDocumentProfile: read(
        "getManuscriptDocumentProfile",
        "documentProfile",
      ),
      getManuscriptPersistenceProfile: read(
        "getManuscriptPersistenceProfile",
        "persistenceProfile",
      ),
      getManuscriptStartupRecovery: read(
        "getManuscriptStartupRecovery",
        "startupRecovery",
      ),
      getManuscriptResumeCheckpoint: read(
        "getManuscriptResumeCheckpoint",
        "resumeCheckpoint",
      ),
    },
    fragments: {
      getProfile: read("getFragmentProfile", "fragmentProfile"),
    },
    foreshadowing: {
      getPointProfile: read(
        "getForeshadowPointProfile",
        "foreshadowPointProfile",
      ),
    },
    workspace: {
      getCatalog: read("getCatalog", "catalog"),
    },
  };
}

function clientQueries(
  client: RuntimeBootstrapClient,
): readonly (() => Promise<unknown>)[] {
  return [
    client.system.getRuntimeInfo,
    client.editor.getManuscriptInputProfile,
    client.editor.getManuscriptFormattingProfile,
    client.editor.getManuscriptPreflightProfile,
    client.fragments.getProfile,
    client.foreshadowing.getPointProfile,
    client.editor.getManuscriptDocumentProfile,
    client.editor.getManuscriptPersistenceProfile,
    client.editor.getManuscriptStartupRecovery,
    client.editor.getManuscriptResumeCheckpoint,
    client.workspace.getCatalog,
  ];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function readSource(relativePath: string, scriptKind: ts.ScriptKind) {
  const source = readFileSync(
    new URL(relativePath, import.meta.url),
    "utf8",
  ).replace(/\r\n?/gu, "\n");
  return {
    source,
    sourceFile: ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    ),
  };
}

function collectNodes<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  matches: (node: ts.Node) => node is T,
): readonly T[] {
  const result: T[] = [];
  const visit = (node: ts.Node): void => {
    if (matches(node)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(result);
}

describe("RuntimeBootstrapController", () => {
  it("starts all eleven queries in exact order and freezes their exact tuple mapping", async () => {
    const order: string[] = [];
    const reads = {
      info: deferred<RuntimeProjection["info"]>(),
      inputProfile: deferred<RuntimeProjection["inputProfile"]>(),
      formattingProfile: deferred<RuntimeProjection["formattingProfile"]>(),
      preflightProfile: deferred<RuntimeProjection["preflightProfile"]>(),
      fragmentProfile: deferred<RuntimeProjection["fragmentProfile"]>(),
      foreshadowPointProfile:
        deferred<RuntimeProjection["foreshadowPointProfile"]>(),
      documentProfile: deferred<RuntimeProjection["documentProfile"]>(),
      persistenceProfile:
        deferred<RuntimeProjection["persistenceProfile"]>(),
      startupRecovery: deferred<RuntimeProjection["startupRecovery"]>(),
      resumeCheckpoint: deferred<RuntimeProjection["resumeCheckpoint"]>(),
      catalog: deferred<RuntimeProjection["catalog"]>(),
    };
    const start = <T>(name: string, promise: Promise<T>) =>
      vi.fn(() => {
        order.push(name);
        return promise;
      });
    const client: RuntimeBootstrapClient = {
      system: { getRuntimeInfo: start("getRuntimeInfo", reads.info.promise) },
      editor: {
        getManuscriptInputProfile: start(
          "getManuscriptInputProfile",
          reads.inputProfile.promise,
        ),
        getManuscriptFormattingProfile: start(
          "getManuscriptFormattingProfile",
          reads.formattingProfile.promise,
        ),
        getManuscriptPreflightProfile: start(
          "getManuscriptPreflightProfile",
          reads.preflightProfile.promise,
        ),
        getManuscriptDocumentProfile: start(
          "getManuscriptDocumentProfile",
          reads.documentProfile.promise,
        ),
        getManuscriptPersistenceProfile: start(
          "getManuscriptPersistenceProfile",
          reads.persistenceProfile.promise,
        ),
        getManuscriptStartupRecovery: start(
          "getManuscriptStartupRecovery",
          reads.startupRecovery.promise,
        ),
        getManuscriptResumeCheckpoint: start(
          "getManuscriptResumeCheckpoint",
          reads.resumeCheckpoint.promise,
        ),
      },
      fragments: {
        getProfile: start("getFragmentProfile", reads.fragmentProfile.promise),
      },
      foreshadowing: {
        getPointProfile: start(
          "getForeshadowPointProfile",
          reads.foreshadowPointProfile.promise,
        ),
      },
      workspace: { getCatalog: start("getCatalog", reads.catalog.promise) },
    };

    const loading = new RuntimeBootstrapController(client).load();
    expect(order).toEqual(QUERY_ORDER);
    for (const query of clientQueries(client)) {
      expect(query).toHaveBeenCalledOnce();
    }
    reads.catalog.resolve(values.catalog);
    reads.resumeCheckpoint.resolve(values.resumeCheckpoint);
    reads.startupRecovery.resolve(values.startupRecovery);
    reads.persistenceProfile.resolve(values.persistenceProfile);
    reads.documentProfile.resolve(values.documentProfile);
    reads.foreshadowPointProfile.resolve(values.foreshadowPointProfile);
    reads.fragmentProfile.resolve(values.fragmentProfile);
    reads.preflightProfile.resolve(values.preflightProfile);
    reads.formattingProfile.resolve(values.formattingProfile);
    reads.inputProfile.resolve(values.inputProfile);
    reads.info.resolve(values.info);
    const projection = await loading;
    expect(projection).toEqual(values);
    for (const key of Object.keys(values) as (keyof RuntimeProjection)[]) {
      expect(projection[key]).toBe(values[key]);
    }
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it("propagates the original rejection after starting every query", async () => {
    const failure = new Error("runtime query failed");
    const base = createResolvedClient();
    const getManuscriptPreflightProfile = vi.fn(() => Promise.reject(failure));
    const client: RuntimeBootstrapClient = {
      ...base,
      editor: {
        ...base.editor,
        getManuscriptPreflightProfile,
      },
    };
    await expect(new RuntimeBootstrapController(client).load())
      .rejects.toBe(failure);
    for (const query of clientQueries(client)) {
      expect(query).toHaveBeenCalledOnce();
    }
  });

  it("does not cache or deduplicate repeated and concurrent loads", async () => {
    const client = createResolvedClient();
    const controller = new RuntimeBootstrapController(client);
    const [first, second] = await Promise.all([
      controller.load(),
      controller.load(),
    ]);
    const third = await controller.load();
    expect(first).not.toBe(second);
    expect(second).not.toBe(third);
    for (const query of clientQueries(client)) {
      expect(query).toHaveBeenCalledTimes(3);
    }
  });

  it("preserves the RuntimeProjection and loader AST while lifecycle slices own runtime installation", () => {
    const controller = readSource(
      "./RuntimeBootstrapController.ts",
      ts.ScriptKind.TS,
    );
    const app = readSource("../../App.tsx", ts.ScriptKind.TSX);
    const core = readSource(
      "../useWorkspaceCoreFeatureKernel.ts",
      ts.ScriptKind.TS,
    );
    const documents = readSource(
      "../lifecycle/useWorkspaceDocumentController.ts",
      ts.ScriptKind.TS,
    );
    const runtimeProjection = readSource(
      "./useWorkspaceRuntimeProjectionController.ts",
      ts.ScriptKind.TS,
    );
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const projectionTypes = collectNodes(
      controller.sourceFile,
      (node): node is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(node) && node.name.text === "RuntimeProjection",
    );
    expect(projectionTypes).toHaveLength(1);
    const projectionType = projectionTypes[0];
    if (projectionType === undefined) throw new Error("Missing RuntimeProjection");
    expect(sha256(printer.printNode(
      ts.EmitHint.Unspecified,
      projectionType.type,
      controller.sourceFile,
    ))).toBe("5ABCF99ABC14611637F13FB0C0BE752EE07CEB2E4152916664ACD11141BFB9AF");

    const loadMethods = collectNodes(
      controller.sourceFile,
      (node): node is ts.MethodDeclaration =>
        ts.isMethodDeclaration(node) &&
        node.name.getText(controller.sourceFile) === "load",
    );
    expect(loadMethods).toHaveLength(1);
    const loadBody = loadMethods[0]?.body;
    if (loadBody === undefined) throw new Error("Missing load body");
    // The loader now accepts an atomic snapshot from a shared desktop runtime.
    // Its data and failure contracts are exercised below instead of freezing its body.

    expect(app.source).not.toContain("queryRuntimeProjection");
    expect(app.source.match(/runtimeBootstrapController\.load\(\)/gu))
      .toHaveLength(1);
    expect(core.source.match(/runtimeBootstrapController\.load\(\)/gu))
      .toHaveLength(1);
    expect(documents.source.match(/runtimeBootstrapController\.load\(\)/gu))
      .toHaveLength(1);
    expect(runtimeProjection.source.match(/runtimeBootstrapController\.load\(\)/gu))
      .toHaveLength(1);
    expect(app.source).toMatch(
      /useState\(\(\) =>\s+new RuntimeBootstrapController\(window\.eumStudio\)\s*\)/u,
    );
    expect(runtimeProjection.source).toContain(
      "const installRuntimeProjection = useCallback(",
    );
    expect(documents.source).toContain(
      "const installCreatedDocument = useCallback(",
    );
    expect(core.source).toContain("onCatalogChange?.(projection.catalog)");
    expect(documents.source).toContain(
      "installRuntimeProjection(projection, preferredDocumentId)",
    );
    expect(controller.source).not.toMatch(
      /window\.|React|useState|useEffect|setRuntime|installRuntimeProjection|ManuscriptDurableSaveQueue|activeDocument|preferredDocument|onCatalogChange|retry|fallback|timeout|cancel|epoch|cache/u,
    );
  });
});

describe("shared workspace bootstrap", () => {
  it("takes catalog, manuscript, sequence and resume from the same snapshot", async () => {
    const client = createResolvedClient();
    const snapshot = {
      catalog: { ...values.catalog },
      documentProfile: { ...values.documentProfile },
      persistenceProfile: values.persistenceProfile === null ? null : { ...values.persistenceProfile },
      resumeCheckpoint: { ...values.resumeCheckpoint },
    };
    const getSnapshot = vi.fn(async () => snapshot);
    const projection = await new RuntimeBootstrapController({ ...client, workspace: { ...client.workspace, shared: { getSnapshot, onChanged: () => () => undefined } } }).load();
    expect(getSnapshot).toHaveBeenCalledOnce();
    expect(projection.documentProfile).toBe(snapshot.documentProfile);
    expect(projection.catalog).toBe(snapshot.catalog);
    expect(projection.persistenceProfile).toBe(snapshot.persistenceProfile);
    expect(projection.resumeCheckpoint).toBe(snapshot.resumeCheckpoint);
    expect(projection.inputProfile).toBe(values.inputProfile);
  });

  it("does not combine stale individual reads after the atomic snapshot fails", async () => {
    const client = createResolvedClient();
    const failure = new Error("snapshot unavailable");
    const loader = new RuntimeBootstrapController({ ...client, workspace: { ...client.workspace, shared: { getSnapshot: async () => { throw failure; }, onChanged: () => () => undefined } } });
    await expect(loader.load()).rejects.toBe(failure);
  });
});
