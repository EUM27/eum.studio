import { resolve } from "node:path";
import process from "node:process";
import { architectureViolations, readArchitectureSources, sourceRootFromArgs } from "./architecture-source.mjs";

const root = sourceRootFromArgs(resolve(import.meta.dirname, ".."), process.argv.slice(2));
const sources = readArchitectureSources(root);
const errors = architectureViolations(sources);
if (sources.length === 0) errors.push("No production source files were found");
if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`architecture boundaries: ok (${sources.length} production files inspected)\n`);
}
