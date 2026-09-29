// Static analysis only. Never execute the fixture or overwrite an earlier case.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn, execFileSync} = require('node:child_process');
const {summarize} = require('./summarize.cjs');

const root = path.resolve(__dirname, '../..');
const [cliArg, outputArg, name] = process.argv.slice(2);
const cases = {
  baseline: ['baseline/caller.ts'],
  negative: ['negative.ts'],
  react: ['react.tsx'],
  'react-no-external': ['react.tsx', '--no-callgraph-external'],
};
if (!cliArg || !outputArg || !Object.hasOwn(cases, name))
  throw new Error('Usage: node tools/flow-evaluation/run.cjs <CLI> <new-results-dir> <baseline|negative|react|react-no-external>');

const cli = path.resolve(cliArg);
const output = path.resolve(outputArg, name);
fs.accessSync(cli, fs.constants.R_OK);
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.mkdirSync(output); // EEXIST is intentional: raw evidence must not be overwritten.
const fixtureRoot = path.join(root, 'tests/flow/fixtures');
const args = ['--max-old-space-size=4096', cli, '--basedir', root,
  '--timeout', '90', '--no-print-progress', '--warnings-unsupported',
  '--diagnostics-json', path.join(output, 'diagnostics.json'),
  '--callgraph-json', path.join(output, 'graph.json'),
  path.join(fixtureRoot, cases[name][0]), ...cases[name].slice(1)];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureFiles = ['baseline/caller.ts', 'baseline/leaf.ts', 'baseline/barrel.ts',
  'baseline/tsconfig.json', 'negative.ts', 'react.tsx'];
const run = {
  name, cwd: root, node: process.version, args,
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8', windowsHide: true}).trim(),
  sourceChanges: execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8', windowsHide: true}).trim(),
  cliSha256: sha256(cli), rootLockSha256: sha256(path.join(root, 'package-lock.json')),
  fixtureLockSha256: sha256(path.join(root, 'tests/flow/package-lock.json')),
  fixtures: Object.fromEntries(fixtureFiles.map(file => [file, sha256(path.join(fixtureRoot, file))])),
  dependencies: Object.fromEntries(['react', 'react-dom'].map(name => [name,
    JSON.parse(fs.readFileSync(path.join(root, 'tests/flow/node_modules', name, 'package.json'), 'utf8')).version])),
  startedAt: new Date().toISOString(), code: null, signal: null, killed: false,
};
const log = fs.openSync(path.join(output, 'analysis.log'), 'wx');
const start = performance.now();
const child = spawn(process.execPath, args, {cwd: root, windowsHide: true, stdio: ['ignore', log, log]});
const deadline = setTimeout(() => { run.killed = true; child.kill(); }, 120000);
child.on('error', error => { run.error = String(error); });
child.on('close', (code, signal) => {
  clearTimeout(deadline);
  fs.closeSync(log);
  Object.assign(run, {code, signal, elapsedMs: Math.round(performance.now() - start)});
  fs.writeFileSync(path.join(output, 'run.json'), JSON.stringify(run, null, 2) + '\n');
  const summary = summarize(output);
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  // Known Map defects are reported explicitly, not treated as regressions here.
  process.exitCode = summary.status === 'completed' && summary.selectedChecksPassed ? 0 : 1;
});
