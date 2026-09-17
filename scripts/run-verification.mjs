import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { coreScenarios } from "../playwright.core.config.ts";
import { captureVerificationSource, fileChecksum, repositoryPath, watchVerificationCode } from "./verification-source.mjs";

const requiredChecks = ["lint", "typecheck", "test:run", "architecture:check", "build"];

function segment(value, label) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(value) || value.endsWith(".") || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(value)) {
    throw new Error(`${label} must be a safe single directory name`);
  }
  return value;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} must be a positive safe integer`);
  return number;
}

export async function resolveNpmCliPath(environment = process.env) {
  const candidates = environment.npm_execpath ? [environment.npm_execpath] : [
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
  ];
  for (const candidate of candidates) {
    const path = await realpath(candidate).catch(() => null);
    if (path === null || basename(path) !== "npm-cli.js") continue;
    const manifest = await readFile(join(dirname(path), "../package.json"), "utf8").then(JSON.parse).catch(() => null);
    if (manifest?.name === "npm" && manifest.bin?.npm === "bin/npm-cli.js" && (await stat(path)).isFile()) return path;
  }
  throw new Error("A valid npm CLI was not found; run verification through npm using the supported Node installation");
}

export function createVerificationPlan({ suite, runId, processBudgetMs, packageDirectoryName, platform = process.platform }) {
  segment(runId, "Run ID");
  if (suite === "core") return requiredChecks.map((script) => ({ script })).concat([{ script: "test:e2e:core", electron: true }]);
  if (suite !== "heavy") throw new Error("Verification suite must be core or heavy");
  if (platform !== "win32") throw new Error("Heavy candidate verification requires Windows");
  const budgetMs = positiveInteger(processBudgetMs, "--process-budget-ms");
  const candidate = segment(packageDirectoryName ?? `eum-studio-verification-${runId}`, "Candidate directory");
  if (candidate.toLowerCase() === "eum-studio-win-x64") throw new Error("Heavy verification cannot replace the default installed package");
  return [
    { script: "test:process:poc-3", processBudgetMs: budgetMs },
    { script: "package:win", candidate, createsCandidate: true },
    { script: "verify:package:win", candidate },
    { script: "test:e2e:core", candidate, electron: true },
  ];
}

function childEnvironment(environment) {
  // Test-owned workspace/profile selection must not inherit a live app target.
  return Object.fromEntries(Object.entries(environment).filter(([key, value]) => value !== undefined && !key.startsWith("EUM_STUDIO_")));
}

async function requireUnusedCandidate(cwd, name) {
  const target = repositoryPath(cwd, join("out", name));
  const existing = await lstat(target).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
  if (existing !== null) throw new Error(`Candidate output already exists and will not be replaced: out/${name}`);
}

async function runCommand(cwd, npmCli, stage, env, logPath) {
  const args = [npmCli, "run", stage.script];
  const log = createWriteStream(logPath, { flags: "wx" });
  const logFinished = finished(log);
  // Attach immediately so an output filesystem error is never unhandled.
  void logFinished.catch(() => undefined);
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let spawnError = null;
  child.stdout.on("data", (chunk) => { log.write(chunk); process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { log.write(chunk); process.stderr.write(chunk); });
  log.once("error", () => child.kill());
  const result = await new Promise((resolve) => {
    child.once("error", (error) => { spawnError = error.message; });
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });
  log.end();
  await logFinished;
  return {
    command: { executable: process.execPath, args, script: stage.script },
    startedAt, endedAt: new Date().toISOString(), ...result, spawnError,
    log: { path: basename(logPath), sha256: await fileChecksum(logPath) },
  };
}

export function validateCoreResults(report) {
  const actual = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) actual.push({ file: basename(spec.file), title: spec.title, ...test });
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  visit(report);
  if ((report.errors ?? []).length !== 0 || actual.length !== coreScenarios.length) throw new Error("Required Electron scenario coverage is incomplete");
  for (const expected of coreScenarios) {
    const match = actual.filter((test) => test.projectName === expected.id && test.file === expected.file && test.title === expected.title);
    if (match.length !== 1 || match[0].status !== "expected" || match[0].expectedStatus !== "passed" || match[0].results.length !== 1 || match[0].results[0].status !== "passed") {
      throw new Error(`Required Electron scenario did not pass exactly once: ${expected.id}`);
    }
  }
  return coreScenarios.map(({ id }) => id);
}

async function retainTraces(source, target) {
  const retained = [];
  async function visit(directory, segments = []) {
    for (const entry of await readdir(directory, { withFileTypes: true }).catch((error) => { if (error.code === "ENOENT") return []; throw error; })) {
      if (entry.name === "electron-user-data") continue;
      const parts = [...segments, entry.name];
      if (entry.isDirectory()) await visit(join(directory, entry.name), parts);
      else if (entry.isFile() && entry.name === "trace.zip") {
        const destination = repositoryPath(target, join(...parts));
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(join(directory, entry.name), destination);
        retained.push({ path: `traces/${parts.join("/")}`, sha256: await fileChecksum(destination) });
      }
    }
  }
  await visit(source);
  return retained;
}

export async function runVerification({ cwd, suite, runId = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomUUID()}`, processBudgetMs, packageDirectoryName, stages, environment = process.env }) {
  segment(runId, "Run ID");
  const reportDirectory = repositoryPath(cwd, join("artifacts/verification", runId));
  await mkdir(dirname(reportDirectory), { recursive: true });
  await mkdir(reportDirectory); // Exclusive run directory; never overwrite evidence.
  const reportPath = join(reportDirectory, "verification.json");
  const report = { schemaVersion: 1, runId, suite, startedAt: new Date().toISOString(), endedAt: null, status: "running", nodeVersion: process.version, platform: process.platform, sourceAtStart: null, sourceAtEnd: null, sourceChanged: false, codeWatch: null, stages: [], error: null };
  const save = () => writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  let codeWatch = null;
  try {
    await save();
    const plan = stages ?? createVerificationPlan({ suite, runId, processBudgetMs, packageDirectoryName });
    if (plan.length === 0) throw new Error("Verification plan must have at least one command");
    // These generated roots must exist before the source-directory baseline;
    // producing their contents later must not change the repository root itself.
    for (const directory of ["dist-electron", "dist-renderer", "out", ...(plan.some((stage) => stage.electron) ? [`test-results-verification-${runId}`] : [])]) {
      await mkdir(repositoryPath(cwd, directory), { recursive: true });
    }
    report.sourceAtStart = await captureVerificationSource(cwd);
    codeWatch = watchVerificationCode(cwd, report.sourceAtStart);
    const npmCli = await resolveNpmCliPath(environment);
    const baseline = report.sourceAtStart;
    const checkSource = async (source) => {
      report.codeWatch = await codeWatch.read();
      if (report.codeWatch.error !== null) throw new Error(`Source watch failed: ${report.codeWatch.error}`);
      if (report.codeWatch.changedPaths.length > 0 || source.provenance.commit !== baseline.provenance.commit || source.codeFingerprint.sha256 !== baseline.codeFingerprint.sha256) {
        report.sourceChanged = true;
        throw new Error("Current code or commit changed during verification; this run cannot verify the final source");
      }
    };
    for (const [index, stage] of plan.entries()) {
      const before = await captureVerificationSource(cwd);
      await checkSource(before);
      const result = { script: stage.script, status: "running", sourceBefore: { commit: before.provenance.commit, codeFingerprint: before.codeFingerprint.sha256 }, sourceAfter: null };
      report.stages.push(result);
      await save();
      const env = childEnvironment(environment);
      if (stage.processBudgetMs !== undefined) {
        result.processBudgetMs = positiveInteger(stage.processBudgetMs, "Process stage budget");
        result.processDeadlineEpochMs = Date.now() + result.processBudgetMs;
        if (!Number.isSafeInteger(result.processDeadlineEpochMs)) throw new Error("Process stage deadline exceeds safe integer range");
        env.EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS = String(result.processDeadlineEpochMs);
      }
      if (stage.candidate) {
        if (stage.createsCandidate) await requireUnusedCandidate(cwd, stage.candidate);
        env.EUM_STUDIO_WINDOWS_PACKAGE_DIRECTORY_NAME = stage.candidate;
        result.candidateDirectory = `out/${stage.candidate}`;
      }
      const electronOutput = repositoryPath(cwd, `test-results-verification-${runId}`);
      const electronResultPath = join(reportDirectory, "playwright-results.json");
      if (stage.electron) {
        env.EUM_STUDIO_VERIFICATION_PLAYWRIGHT_RESULT_PATH = electronResultPath;
        env.EUM_STUDIO_VERIFICATION_PLAYWRIGHT_OUTPUT_DIR = electronOutput;
        if (stage.candidate) {
          const packageRoot = repositoryPath(cwd, join("out", stage.candidate));
          const manifest = JSON.parse(await readFile(join(packageRoot, "package-manifest.json"), "utf8"));
          env.EUM_STUDIO_E2E_EXECUTABLE_PATH = repositoryPath(packageRoot, manifest.executable);
          if (!(await stat(env.EUM_STUDIO_E2E_EXECUTABLE_PATH)).isFile()) throw new Error("Candidate executable is missing");
        }
      }
      const command = await runCommand(cwd, npmCli, stage, env, join(reportDirectory, `${String(index + 1).padStart(2, "0")}-${stage.script.replaceAll(":", "-")}.log`));
      Object.assign(result, command);
      result.status = command.exitCode === 0 && command.signal === null && command.spawnError === null ? "passed" : "failed";
      if (stage.electron) result.traces = await retainTraces(electronOutput, join(reportDirectory, "traces"));
      const after = await captureVerificationSource(cwd);
      report.sourceAtEnd = after;
      result.sourceAfter = { commit: after.provenance.commit, codeFingerprint: after.codeFingerprint.sha256 };
      await checkSource(after);
      if (result.status === "failed") throw new Error(`Command failed: ${stage.script} (exit ${command.exitCode}, signal ${command.signal})`);
      if (stage.electron) {
        result.verifiedScenarios = validateCoreResults(JSON.parse(await readFile(electronResultPath, "utf8")));
        result.electronResults = { path: basename(electronResultPath), sha256: await fileChecksum(electronResultPath) };
      }
      await save();
    }
    report.sourceAtEnd = await captureVerificationSource(cwd);
    await checkSource(report.sourceAtEnd);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error instanceof Error ? error.message : String(error);
    const last = report.stages.at(-1);
    if (last && (last.status === "running" || report.sourceChanged || last.verifiedScenarios === undefined && last.script === "test:e2e:core")) {
      last.status = "failed";
      last.verificationError = report.error;
    }
    try { report.sourceAtEnd = await captureVerificationSource(cwd); } catch { /* The original failure stays authoritative. */ }
  } finally {
    if (codeWatch !== null) {
      report.codeWatch = await codeWatch.read();
      codeWatch.close();
      if (report.status === "passed" && (report.codeWatch.error !== null || report.codeWatch.changedPaths.length > 0)) {
        report.status = "failed";
        report.sourceChanged = report.codeWatch.changedPaths.length > 0;
        report.error = report.codeWatch.error ?? "Source changed while final verification evidence was being collected";
      }
    }
    report.endedAt = new Date().toISOString();
    await save();
  }
  process.stdout.write(`${JSON.stringify({ verificationReport: reportPath, status: report.status, error: report.error })}\n`);
  return { report, reportPath, exitCode: report.status === "passed" ? 0 : 1 };
}

async function main() {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!["--suite", "--run-id", "--process-budget-ms", "--package-directory-name"].includes(key) || process.argv[index + 1] === undefined || Object.hasOwn(options, key)) throw new Error(`Invalid verification option: ${key}`);
    options[key] = process.argv[index + 1];
  }
  const result = await runVerification({ cwd: process.cwd(), suite: options["--suite"], runId: options["--run-id"], processBudgetMs: options["--process-budget-ms"], packageDirectoryName: options["--package-directory-name"] });
  process.exitCode = result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
