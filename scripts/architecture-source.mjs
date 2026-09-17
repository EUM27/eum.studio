import { Buffer } from "node:buffer";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import ts from "typescript";

export function sourceRootFromArgs(defaultRoot, args) {
  if (args.length === 0) return defaultRoot;
  if (args.length === 2 && args[0] === "--root") return resolve(args[1]);
  throw new Error("Usage: architecture command [--root <workspace>]");
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx|mjs|js)$/u.test(entry.name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(entry.name) ? [file] : [];
  });
}

function resolveLocalImport(from, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(from), specifier);
  const candidates = [base, ...[".ts", ".tsx", ".mjs", ".js"].map((extension) => `${base}${extension}`),
    ...["index.ts", "index.tsx", "index.mjs", "index.js"].map((name) => resolve(base, name))];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

const sqlStart = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA|BEGIN|COMMIT|ROLLBACK|WITH)\b/u;

export function readArchitectureSources(root) {
  return sourceFiles(resolve(root, "src")).map((absolute) => {
    const source = readFileSync(absolute, "utf8");
    const file = relative(root, absolute).replaceAll("\\", "/");
    const tree = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true,
      extname(absolute) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const imports = []; const channels = []; const channelReferences = new Set();
    let classes = 0; let methods = 0; let functions = 0; let sqlStatements = 0;
    let transactions = 0; let directBridgeCalls = 0; let ipcRegistrations = 0; let dynamicImports = 0;
    const addImport = (specifier, typeOnly) => imports.push({ specifier, typeOnly, resolved: resolveLocalImport(absolute, specifier) });
    const visit = (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        let typeOnly = Boolean(ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly);
        if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          typeOnly ||= !node.importClause.name && node.importClause.namedBindings.elements.length > 0 && node.importClause.namedBindings.elements.every((entry) => entry.isTypeOnly);
        }
        if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
          typeOnly ||= node.exportClause.elements.length > 0 && node.exportClause.elements.every((entry) => entry.isTypeOnly);
        }
        addImport(node.moduleSpecifier.text, typeOnly);
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) addImport(node.argument.literal.text, true);
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require")) {
          if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) addImport(node.arguments[0].text, false);
          else dynamicImports += 1;
        }
        if (ts.isPropertyAccessExpression(node.expression)) {
          if (node.expression.name.text === "transaction") transactions += 1;
          if (["handle", "on", "once"].includes(node.expression.name.text) && /\bipcMain$/u.test(node.expression.expression.getText(tree))) ipcRegistrations += 1;
        }
      }
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) classes += 1;
      if (ts.isMethodDeclaration(node)) methods += 1;
      if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) functions += 1;
      if (ts.isIdentifier(node) && node.text.endsWith("_CHANNEL")) channelReferences.add(node.text);
      if (ts.isStringLiteralLike(node) && node.text.startsWith("studio:")) channels.push(node.text);
      if ((ts.isStringLiteralLike(node) && sqlStart.test(node.text)) || (ts.isTemplateExpression(node) && sqlStart.test(node.head.text))) sqlStatements += 1;
      if (ts.isPropertyAccessExpression(node) && node.name.text === "eumStudio" && /^(?:globalThis\.)?window$/u.test(node.expression.getText(tree))) directBridgeCalls += 1;
      if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) &&
        node.argumentExpression.text === "eumStudio" && /^(?:globalThis\.)?window$/u.test(node.expression.getText(tree))) directBridgeCalls += 1;
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return { absolute, file, imports, channels, channelReferences: [...channelReferences],
      bytes: Buffer.byteLength(source), lines: source.split(/\r?\n/u).length,
      useState: source.match(/\buseState\s*(?:<|\()/gu)?.length ?? 0,
      useRef: source.match(/\buseRef\s*(?:<|\()/gu)?.length ?? 0,
      directBridgeCalls, classes, methods, functions, sqlStatements, transactions, ipcRegistrations, dynamicImports,
      parseErrors: tree.parseDiagnostics.length };
  });
}

export function runtimeServiceCycles(sources) {
  const services = new Map(sources.filter((entry) => entry.file.startsWith("src/desktop/workspace-runtime/")).map((entry) => [entry.absolute, entry]));
  const visited = new Set(); const active = new Set(); const stack = []; const cycles = [];
  const visit = (file) => {
    if (active.has(file)) {
      cycles.push([...stack.slice(stack.indexOf(file)), file].map((key) => services.get(key).file));
      return;
    }
    if (visited.has(file)) return;
    visited.add(file); active.add(file); stack.push(file);
    for (const dependency of services.get(file).imports) {
      if (!dependency.typeOnly && services.has(dependency.resolved)) visit(dependency.resolved);
    }
    stack.pop(); active.delete(file);
  };
  for (const file of services.keys()) visit(file);
  return cycles;
}

export function architectureViolations(sources) {
  const errors = [];
  const composition = new Set(["src/renderer/App.tsx", "src/renderer/StudioShell.tsx", "src/renderer/WorkspaceRoot.tsx", "src/renderer/StudioRoot.tsx"]);
  const desktopEntryPoints = new Set(["src/desktop/main.ts", "src/desktop/bootstrap.ts", "src/desktop/local-workspace-runtime.ts"]);
  const byPath = new Map(sources.map((entry) => [entry.absolute, entry.file]));
  const owners = new Map();
  for (const entry of sources) {
    if (entry.parseErrors > 0) errors.push(`${entry.file} has TypeScript parse errors`);
    if (entry.file.startsWith("src/domain/") && entry.imports.some(({ specifier }) =>
      /^(?:node:|electron(?:\/|$)|react(?:-dom)?(?:\/|$)|better-sqlite3$)/u.test(specifier) || /(?:^|\/)(?:platform|desktop)(?:\/|$)/u.test(specifier))) {
      errors.push(`${entry.file} imports a forbidden runtime layer`);
    }
    if (entry.file.startsWith("src/renderer/") && entry.file.endsWith(".tsx") && !composition.has(entry.file) && entry.directBridgeCalls > 0) errors.push(`${entry.file} accesses window.eumStudio from a view`);
    if (entry.file.startsWith("src/application/contracts/")) {
      for (const channel of entry.channels) {
        const previous = owners.get(channel);
        if (previous) errors.push(`duplicate bridge channel ${channel}: ${previous} and ${entry.file}`);
        else owners.set(channel, entry.file);
      }
    }
    if (desktopEntryPoints.has(entry.file) && (entry.channelReferences.length > 0 || entry.channels.length > 0)) errors.push(`${entry.file} imports or references an individual IPC channel`);
    if (desktopEntryPoints.has(entry.file) && entry.sqlStatements > 0) errors.push(`${entry.file} contains business SQL instead of composing services`);
    if (entry.file.startsWith("src/desktop/workspace-runtime/")) {
      for (const dependency of entry.imports) {
        const target = byPath.get(dependency.resolved);
        if (target && desktopEntryPoints.has(target)) errors.push(`${entry.file} imports the central runtime facade ${target}`);
        if (dependency.specifier === "electron" || target?.startsWith("src/desktop/ipc/")) errors.push(`${entry.file} imports an IPC adapter`);
      }
      if (entry.ipcRegistrations > 0 || entry.channelReferences.length > 0 || entry.channels.length > 0) errors.push(`${entry.file} owns IPC details instead of business behavior`);
      if (entry.dynamicImports > 0) errors.push(`${entry.file} uses an unresolvable dynamic module dependency`);
    }
  }
  for (const cycle of runtimeServiceCycles(sources)) errors.push(`runtime service dependency cycle: ${cycle.join(" -> ")}`);
  return errors;
}
