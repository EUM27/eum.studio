import { resolve } from "node:path";
import process from "node:process";
import { architectureViolations, readArchitectureSources, runtimeServiceCycles, sourceRootFromArgs } from "./architecture-source.mjs";

const root = sourceRootFromArgs(resolve(import.meta.dirname, ".."), process.argv.slice(2));
const sources = readArchitectureSources(root);
const byPath = new Map(sources.map((entry) => [entry.absolute, entry.file]));
const files = sources.map((entry) => ({
  file: entry.file, bytes: entry.bytes, lines: entry.lines, useState: entry.useState, useRef: entry.useRef,
  directBridgeCalls: entry.directBridgeCalls, classes: entry.classes, methods: entry.methods, functions: entry.functions,
  sqlStatements: entry.sqlStatements, transactions: entry.transactions, parseErrors: entry.parseErrors,
  imports: entry.imports.length,
  dependencies: entry.imports.map((dependency) => ({ module: byPath.get(dependency.resolved) ?? dependency.specifier, typeOnly: dependency.typeOnly })),
})).sort((left, right) => right.bytes - left.bytes || left.file.localeCompare(right.file));
process.stdout.write(`${JSON.stringify({
  schemaVersion: 2, files,
  summary: { productionFiles: files.length, totalBytes: files.reduce((total, entry) => total + entry.bytes, 0),
    desktopFiles: files.filter((entry) => entry.file.startsWith("src/desktop/")).length,
    runtimeServiceFiles: files.filter((entry) => entry.file.startsWith("src/desktop/workspace-runtime/")).length },
  runtimeServiceCycles: runtimeServiceCycles(sources),
  violations: architectureViolations(sources),
}, null, 2)}\n`);
