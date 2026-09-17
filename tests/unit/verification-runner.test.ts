import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";
import { coreScenarios } from "../../playwright.core.config";

// These integration fixtures launch Git, Node and npm and inspect real NTFS
// writes. Their process startup time is not a five-second product benchmark.
vi.setConfig({ testTimeout: 30_000 });

const runnerUrl = pathToFileURL(path.join(process.cwd(), "scripts/run-verification.mjs")).href;
const sourceUrl = pathToFileURL(path.join(process.cwd(), "scripts/verification-source.mjs")).href;

function node(script: string, arguments_: readonly string[], cwd: string) {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, ...arguments_], {
    cwd, encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

async function fixture(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), "eum-verification-"));
  const relative = path.relative(tmpdir(), directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid verification fixture cleanup path");
  try {
    await mkdir(path.join(directory, "src"));
    await mkdir(path.join(directory, "src/empty-existing"));
    await writeFile(path.join(directory, "src/module.ts"), "export const value = 1;\n");
    // Whole-second fixture times let utimes preserve mtime exactly while a test
    // changes atime; filesystem timestamp precision must not fabricate a write.
    const fixtureTime = new Date(Math.floor(Date.now() / 1000) * 1000);
    await utimes(path.join(directory, "src/module.ts"), fixtureTime, fixtureTime);
    await utimes(path.join(directory, "src"), fixtureTime, fixtureTime);
    await utimes(path.join(directory, "src/empty-existing"), fixtureTime, fixtureTime);
    await writeFile(path.join(directory, ".gitignore"), "artifacts/\nout/\ndist-electron/\ndist-renderer/\nnode_modules/\ntest-results-verification-*/\n");
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: "verification-fixture", private: true, scripts: {
      first: "node command.cjs first", fail: "node command.cjs fail", last: "node command.cjs last", mutate: "node command.cjs mutate", revert: "node command.cjs revert", bookkeeping: "node command.cjs bookkeeping", deadline: "node command.cjs deadline", inspect: "node command.cjs inspect", access: "node command.cjs access", attributes: "node command.cjs attributes", create: "node command.cjs create", delete: "node command.cjs delete", rename: "node command.cjs rename", replace: "node command.cjs replace", "preserved-mtime": "node command.cjs preserved-mtime", "directory-access": "node command.cjs directory-access", "directory-rename": "node command.cjs directory-rename", generated: "node command.cjs generated",
    } }));
    await writeFile(path.join(directory, "command.cjs"), `const fs = require('node:fs');
const action = process.argv[2];
process.stdout.write(action + '\\n');
if (action === 'fail') { process.stderr.write('command failed\\n'); process.exitCode = 7; }
if (action === 'mutate') fs.writeFileSync('src/module.ts', 'export const value = 2;\\n');
if (action === 'revert') { const before=fs.readFileSync('src/module.ts'); fs.writeFileSync('src/module.ts','export const value = 2;\\n'); fs.writeFileSync('src/module.ts',before); }
if (action === 'bookkeeping') { fs.mkdirSync('docs/goals', {recursive:true}); fs.writeFileSync('docs/goals/state.yaml', 'receipt: updated\\n'); }
if (action === 'deadline') { fs.writeFileSync('artifacts/deadline.json',JSON.stringify({deadline: Number(process.env.EUM_STUDIO_POC_3_PROCESS_TEST_DEADLINE_EPOCH_MS), now: Date.now(), inheritedWorkspace: Object.hasOwn(process.env,'EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH')})); }
if (action === 'inspect') fs.readFileSync('src/module.ts');
if (action === 'access') { const before=fs.statSync('src/module.ts'); fs.readFileSync('src/module.ts'); fs.utimesSync('src/module.ts',new Date(before.atime.getTime()-3600000),before.mtime); }
if (action === 'attributes') { const mode=fs.statSync('src/module.ts').mode; fs.chmodSync('src/module.ts',0o444); fs.chmodSync('src/module.ts',mode); }
if (action === 'create') fs.writeFileSync('src/new.ts','export const added = true;\\n');
if (action === 'delete') fs.unlinkSync('src/module.ts');
if (action === 'rename') fs.renameSync('src/module.ts','src/renamed.ts');
if (action === 'replace') { const before=fs.statSync('src/module.ts'); fs.copyFileSync('src/module.ts','src/replacement.ts'); fs.utimesSync('src/replacement.ts',before.atime,before.mtime); fs.renameSync('src/replacement.ts','src/module.ts'); }
if (action === 'preserved-mtime') { const before=fs.statSync('src/module.ts'); fs.writeFileSync('src/module.ts','export const value = 2;\\n'); fs.utimesSync('src/module.ts',before.atime,before.mtime); }
if (action === 'directory-access') { for (const directory of ['src','src/empty-existing']) { const before=fs.statSync(directory); fs.readdirSync(directory); fs.utimesSync(directory,new Date(before.atime.getTime()-3600000),before.mtime); } }
if (action === 'directory-rename') { fs.renameSync('src','renamed-src'); fs.renameSync('renamed-src','src'); }
if (action === 'generated') { for (const directory of ['dist-electron/generated','out/candidate/generated','node_modules/fixture/generated']) { fs.mkdirSync(directory,{recursive:true}); for(let i=0;i<512;i++) fs.writeFileSync(directory+'/'+i+'.js','generated fixture'); } }
`);
    for (const args of [["init", "-q"], ["add", "."], ["-c", "user.name=Verification Fixture", "-c", "user.email=verification@example.invalid", "commit", "-qm", "fixture"]]) {
      const result = spawnSync("git", args, { cwd: directory, encoding: "utf8", windowsHide: true });
      if (result.error) throw result.error;
      expect(result.status, result.stderr).toBe(0);
    }
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runFixture(directory: string, scripts: readonly string[]) {
  const runId = randomUUID();
  const execution = node(`const { runVerification } = await import(process.argv[1]);
const result = await runVerification(JSON.parse(process.argv[2])); process.exitCode = result.exitCode;`,
  [runnerUrl, JSON.stringify({ cwd: directory, suite: "runner-contract", runId, stages: scripts.map((script) => ({ script })) })], directory);
  const reportPath = path.join(directory, "artifacts/verification", runId, "verification.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  return { execution, report, reportPath };
}

it("records actual command logs, exit statuses and current tracked plus untracked code", async () => {
  await fixture(async (directory) => {
    await writeFile(path.join(directory, "src/new-module.ts"), "export const pending = true;\n");
    const { execution, report, reportPath } = await runFixture(directory, ["first", "last"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report.status).toBe("passed");
    expect(report.sourceAtStart.provenance).toMatchObject({ dirty: true, untrackedFileCount: 1 });
    expect(report.sourceAtStart.provenance.commit).toMatch(/^[a-f0-9]{40,64}$/u);
    expect(report.sourceAtStart.codeFingerprint.entries).toContainEqual(expect.objectContaining({ path: "src/new-module.ts", sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) }));
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
    expect(report.stages.map((stage: { exitCode: number }) => stage.exitCode)).toEqual([0, 0]);
    for (const stage of report.stages) {
      expect(stage.command.executable).toBe(process.execPath);
      expect(stage.startedAt).toBeTruthy();
      expect(stage.endedAt).toBeTruthy();
      expect(await readFile(path.join(path.dirname(reportPath), stage.log.path), "utf8")).toContain(stage.script);
    }
  });
});

it("preserves a real child failure and does not run remaining commands", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["first", "fail", "last"]);
    expect(execution.status).toBe(1);
    expect(report.status).toBe("failed");
    expect(report.stages.map((stage: { script: string }) => stage.script)).toEqual(["first", "fail"]);
    expect(report.stages[1]).toMatchObject({ status: "failed", exitCode: 7 });
    expect(report.error).toContain("Command failed: fail");
  });
});

it("invalidates a nominally successful command when current source changes", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["mutate", "last"]);
    expect(execution.status).toBe(1);
    expect(report).toMatchObject({ status: "failed", sourceChanged: true });
    expect(report.stages).toHaveLength(1);
    expect(report.stages[0]).toMatchObject({ status: "failed", exitCode: 0 });
    expect(report.sourceAtEnd.codeFingerprint.sha256).not.toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("keeps bookkeeping changes visible in full provenance without invalidating unchanged code", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["bookkeeping"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report.sourceChanged).toBe(false);
    expect(report.sourceAtEnd.provenance.sourceFingerprint).not.toBe(report.sourceAtStart.provenance.sourceFingerprint);
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("detects a source edit that is reverted before the next fingerprint", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["revert"]);
    expect(execution.status).toBe(1);
    expect(report).toMatchObject({ status: "failed", sourceChanged: true });
    expect(report.codeWatch.changedPaths).toContain("src/module.ts");
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("accepts actual read-only commands and access-time events when file identity, write time and bytes remain unchanged", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["inspect", "access"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report).toMatchObject({ status: "passed", sourceChanged: false });
    expect(report.codeWatch.changedPaths).toEqual([]);
    expect(report.codeWatch.ignoredMetadataPaths).toContain("src/module.ts");
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("accepts attribute-only events with unchanged source contents", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["attributes"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report).toMatchObject({ status: "passed", sourceChanged: false });
    expect(report.codeWatch.ignoredMetadataPaths).toContain("src/module.ts");
  });
});

it.each(["create", "delete", "rename"])("detects an actual source %s", async (script) => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, [script]);
    expect(execution.status).toBe(1);
    expect(report).toMatchObject({ status: "failed", sourceChanged: true });
    expect(report.codeWatch.changedPaths).toContain(script === "create" ? "src/new.ts" : "src/module.ts");
  });
});

it("ignores directory access metadata even for an empty directory absent from the Git file inventory", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["directory-access"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report).toMatchObject({ status: "passed", sourceChanged: false });
    expect(report.codeWatch.ignoredMetadataPaths).toEqual(expect.arrayContaining(["src", "src/empty-existing"]));
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("detects a source directory rename even when the directory is moved back", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["directory-rename"]);
    expect(execution.status).toBe(1);
    expect(report).toMatchObject({ status: "failed", sourceChanged: true });
    expect(report.codeWatch.changedPaths).toContain("src");
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("detects a replacement with the same bytes and write time", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["replace"]);
    expect(execution.status).toBe(1);
    expect(report).toMatchObject({ status: "failed", sourceChanged: true });
    expect(report.codeWatch.changedPaths).toContain("src/module.ts");
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it("checks event-time bytes even when a content edit preserves size and write time", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["preserved-mtime"]);
    expect(execution.status).toBe(1);
    expect(report).toMatchObject({ status: "failed", sourceChanged: true });
    expect(report.codeWatch.changedPaths).toContain("src/module.ts");
  });
});

it("keeps generated build and dependency subtrees outside native watch subscriptions", async () => {
  await fixture(async (directory) => {
    const { execution, report } = await runFixture(directory, ["generated"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report).toMatchObject({ status: "passed", sourceChanged: false });
    expect(report.codeWatch.watchMode).toBe("source-subtrees-with-shallow-parent-watch");
    expect(report.codeWatch.watchedDirectories).toEqual(expect.arrayContaining([".", "src"]));
    expect(report.codeWatch.subscriptions).toEqual(expect.arrayContaining([{ path: ".", recursive: false }, { path: "src", recursive: true }]));
    expect(report.codeWatch.watchedDirectories.some((value: string) => /^(?:artifacts|out|dist-electron|dist-renderer|node_modules)(?:\/|$)/u.test(value))).toBe(false);
    expect(await readFile(path.join(directory, "dist-electron/generated/511.js"), "utf8")).toBe("generated fixture");
    expect(report.sourceAtEnd.codeFingerprint.sha256).toBe(report.sourceAtStart.codeFingerprint.sha256);
  });
});

it.each(["access", "directory-access", "revert", "delete", "directory-rename", "nested-create"])("reconstructs source evidence when an actual %s event omits its filename", async (action) => {
  await fixture(async (directory) => {
    const result = node(`import fs from 'node:fs'; import path from 'node:path';
const {captureVerificationSource,watchVerificationCode}=await import(process.argv[1]); const cwd=process.cwd();
const before=await captureVerificationSource(cwd); let notify; let timer;
const observed=new Promise((resolve,reject)=>{notify=resolve; timer=setTimeout(()=>reject(new Error('Native source event was not observed')),3000);});
const subscriptions=[];
const monitor=watchVerificationCode(cwd,before,{watchDirectory:(directory,options,listener)=>{
 subscriptions.push({directory:path.relative(cwd,directory),recursive:options.recursive});
 return fs.watch(directory,options,(event)=>{listener(event,null);notify();});
}});
try {
 const file='src/module.ts'; const action=process.argv[2];
 if(action==='access'){const s=fs.statSync(file);fs.readFileSync(file);fs.utimesSync(file,new Date(s.atime.getTime()-3600000),s.mtime);}
 if(action==='directory-access'){const s=fs.statSync('src/empty-existing');fs.readdirSync('src/empty-existing');fs.utimesSync('src/empty-existing',new Date(s.atime.getTime()-3600000),s.mtime);}
 if(action==='revert'){const bytes=fs.readFileSync(file);fs.writeFileSync(file,'export const value = 2;\\n');fs.writeFileSync(file,bytes);}
 if(action==='delete')fs.unlinkSync(file);
 if(action==='directory-rename'){fs.renameSync('src','renamed-src');fs.renameSync('renamed-src','src');}
 if(action==='nested-create'){fs.mkdirSync('src/new/deep',{recursive:true});fs.writeFileSync('src/new/deep/module.ts','export const created = true;\\n');}
 await observed; clearTimeout(timer);
 const state=await monitor.read(); const after=await captureVerificationSource(cwd);
 process.stdout.write(JSON.stringify({state,subscriptions,before:before.codeFingerprint.sha256,after:after.codeFingerprint.sha256}));
} finally {clearTimeout(timer);monitor.close();}`, [sourceUrl, action], directory);
    expect(result.status, result.stderr).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value.state.error).toBeNull();
    expect(value.state.pathlessEventCount).toBeGreaterThan(0);
    expect(value.state.fullRescanCount).toBeGreaterThan(0);
    expect(value.subscriptions).toEqual(expect.arrayContaining([{ directory: "", recursive: false }, { directory: "src", recursive: true }]));
    expect(value.subscriptions.some((entry: { directory: string }) => entry.directory === path.join("src", "empty-existing"))).toBe(false);
    if (action === "access" || action === "directory-access") {
      expect(value.state.changedPaths).toEqual([]);
      expect(value.before).toBe(value.after);
    } else {
      expect(value.state.changedPaths.length).toBeGreaterThan(0);
      if (action === "revert" || action === "directory-rename") expect(value.before).toBe(value.after);
      if (action === "nested-create") expect(value.state.changedPaths).toContain("src/new/deep/module.ts");
    }
  });
});

it("fingerprints recovery scripts and ignore policy while excluding raw recovery artifacts", async () => {
  await fixture(async (directory) => {
    await mkdir(path.join(directory, "recovery"));
    await writeFile(path.join(directory, "recovery/extract.ps1"), "Write-Output 'restore'\n");
    await writeFile(path.join(directory, "recovery/.gitignore"), "# synthetic recovery policy\n");
    await writeFile(path.join(directory, "recovery/renderer.dmp"), "synthetic dump fixture");
    const { execution, report } = await runFixture(directory, ["first"]);
    expect(execution.status, execution.stderr).toBe(0);
    expect(report.sourceAtStart.codeFingerprint.entries.map((entry: { path: string }) => entry.path)).toContain("recovery/extract.ps1");
    expect(report.sourceAtStart.codeFingerprint.entries.map((entry: { path: string }) => entry.path)).toContain("recovery/.gitignore");
    expect(report.sourceAtStart.codeFingerprint.entries.map((entry: { path: string }) => entry.path)).not.toContain("recovery/renderer.dmp");
    expect(report.sourceAtStart.provenance.untrackedFileCount).toBe(3);
  });
});

it("makes heavy prerequisites and a fresh nondefault Windows candidate explicit", () => {
  const result = node(`const { createVerificationPlan } = await import(process.argv[1]);
const options = {suite:'heavy', runId:'contract-run', platform:'win32', processBudgetMs:300000};
const errors = [];
for (const patch of [{processBudgetMs:undefined}, {platform:'linux'}, {packageDirectoryName:'eum-studio-win-x64'}, {packageDirectoryName:'../outside'}]) {
 try { createVerificationPlan({...options,...patch}); } catch (error) { errors.push(error.message); }
}
process.stdout.write(JSON.stringify({plan:createVerificationPlan(options),errors}));`, [runnerUrl], process.cwd());
  expect(result.status, result.stderr).toBe(0);
  const value = JSON.parse(result.stdout);
  expect(value.plan.map((stage: { script: string }) => stage.script)).toEqual(["test:process:poc-3", "package:win", "verify:package:win", "test:e2e:core"]);
  expect(value.plan[0].processBudgetMs).toBe(300000);
  expect(value.plan[1].candidate).toBe("eum-studio-verification-contract-run");
  expect(value.errors).toHaveLength(4);
});

it("passes the caller deadline to a real command and removes inherited live workspace selection", async () => {
  await fixture(async (directory) => {
    const runId = randomUUID();
    const execution = node(`const {runVerification}=await import(process.argv[1]); const options=JSON.parse(process.argv[2]);
const result=await runVerification({...options,environment:{...process.env,EUM_STUDIO_LOCAL_WORKSPACE_ROOT_PATH:'fixture-live-target'}});process.exitCode=result.exitCode;`,
    [runnerUrl, JSON.stringify({ cwd: directory, suite: "runner-contract", runId, stages: [{ script: "deadline", processBudgetMs: 300000 }] })], directory);
    expect(execution.status, execution.stderr).toBe(0);
    const observed = JSON.parse(await readFile(path.join(directory, "artifacts/deadline.json"), "utf8"));
    const report = JSON.parse(await readFile(path.join(directory, "artifacts/verification", runId, "verification.json"), "utf8"));
    expect(observed.inheritedWorkspace).toBe(false);
    expect(observed.deadline).toBe(report.stages[0].processDeadlineEpochMs);
    expect(observed.deadline).toBeGreaterThan(observed.now);
    expect(observed.deadline - observed.now).toBeLessThanOrEqual(300000);
  });
});

it("refuses an existing candidate before the packaging command can overwrite it", async () => {
  await fixture(async (directory) => {
    const candidate = "retained-candidate";
    await mkdir(path.join(directory, "out", candidate), { recursive: true });
    const preservedPath = path.join(directory, "out", candidate, "keep.txt");
    await writeFile(preservedPath, "preserve existing package");
    const runId = randomUUID();
    const execution = node(`const {runVerification}=await import(process.argv[1]); const result=await runVerification(JSON.parse(process.argv[2]));process.exitCode=result.exitCode;`,
    [runnerUrl, JSON.stringify({ cwd: directory, suite: "runner-contract", runId, stages: [{ script: "package:win", candidate, createsCandidate: true }] })], directory);
    expect(execution.status).toBe(1);
    const report = JSON.parse(await readFile(path.join(directory, "artifacts/verification", runId, "verification.json"), "utf8"));
    expect(report.error).toContain("Candidate output already exists");
    expect(report.stages[0].command).toBeUndefined();
    expect(await readFile(preservedPath, "utf8")).toBe("preserve existing package");
  });
});

it("rejects a zero-exit Playwright report that skips or loses a required Electron scenario", () => {
  const scenarios = coreScenarios.map((scenario) => ({
    file: scenario.file, title: scenario.title,
    tests: [{ projectName: scenario.id, expectedStatus: "passed", status: "expected", results: [{ status: "passed" }] }],
  }));
  const result = node(`const {validateCoreResults}=await import(process.argv[1]);
const specs=JSON.parse(process.argv[2]); const passed=validateCoreResults({suites:[{specs}]}); const errors=[];
for (const report of [{suites:[{specs:specs.slice(1)}]}, {suites:[{specs:specs.map((s,i)=>i? s:{...s,tests:[{...s.tests[0],status:'skipped',results:[{status:'skipped'}]}]})}]}]) {
try {validateCoreResults(report);} catch(error){errors.push(error.message);}}
process.stdout.write(JSON.stringify({passed,errors}));`, [runnerUrl, JSON.stringify(scenarios)], process.cwd());
  expect(result.status, result.stderr).toBe(0);
  const value = JSON.parse(result.stdout);
  expect(value.passed).toHaveLength(coreScenarios.length);
  expect(value.errors).toHaveLength(2);
});
