// Read-only DART comparison at the fixed handoff snapshot. Static analysis only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn, execFileSync} = require('node:child_process');
const {summarizeDart} = require('./summarize-dart.cjs');
const [cliArg, outputArg, dartArg, name, ...extraArgs] = process.argv.slice(2);
if (!cliArg || !outputArg || !dartArg || !['hook', 'renderer'].includes(name) ||
    extraArgs.some(arg => !['--react-callback-model', '--map-keys', '--profile-memory'].includes(arg) &&
      !/^--heap-budget=[1-9][0-9]*$/.test(arg)))
  throw new Error('Expected CLI, fresh output directory, DART root, hook|renderer, optional model flags');
const cli = path.resolve(cliArg), dart = fs.realpathSync(dartArg);
const git = (...args) => execFileSync('git', args, {cwd: dart, encoding: 'utf8', windowsHide: true}).trim();
const head = git('rev-parse', 'HEAD');
if (head !== 'e6628e840ed5d9c27f3cb99023a93f6ef979dc5b') throw new Error('DART snapshot changed');
if (git('status', '--porcelain', '--untracked-files=all', '--', 'log-viewer-app/src',
    'package.json', 'package-lock.json', 'log-viewer-app/package.json'))
  throw new Error('DART analysis input has local changes');
const dependencies = fs.realpathSync(path.join(dart, 'node_modules'));
const inside = (file, base) => {
  const relative = path.relative(base, file);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
let base = dart;
while (!inside(dependencies, base)) {
  const parent = path.dirname(base);
  if (parent === base) throw new Error('No common source/dependency ancestor');
  base = parent;
}
const entry = path.join(dart, 'log-viewer-app/src/renderer/src',
  name === 'hook' ? 'app/useWorkspaceAggregate.ts' : 'main.tsx');
const versions = Object.fromEntries(['react', 'react-dom'].map(pkg => [pkg,
  JSON.parse(fs.readFileSync(path.join(dependencies, pkg, 'package.json'))).version]));
if (Object.values(versions).some(v => v !== '18.3.1')) throw new Error('React dependency version changed');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// main.js alone does not identify changes to the solver or native models.
const buildHash = crypto.createHash('sha256');
const hashJavaScript = directory => {
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) hashJavaScript(file);
    else if (name.endsWith('.js')) {
      buildHash.update(path.relative(path.dirname(cli), file).replaceAll('\\', '/') + '\0');
      buildHash.update(fs.readFileSync(file));
    }
  }
};
hashJavaScript(path.dirname(cli));
const output = path.resolve(outputArg, name);
fs.accessSync(cli, fs.constants.R_OK);
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.mkdirSync(output);
const args = ['--max-old-space-size=4096', cli, '--basedir', base, '--timeout', '90',
  '--no-print-progress', '--warnings-unsupported', '--diagnostics-json', path.join(output, 'diagnostics.json'),
  '--callgraph-json', path.join(output, 'graph.json'), entry,
  ...extraArgs.filter(arg => arg !== '--profile-memory').flatMap(arg =>
    arg.startsWith('--heap-budget=') ? ['--max-heap-mb', arg.split('=')[1]] : [arg]),
  ...(extraArgs.includes('--profile-memory') ? ['--memory-trace', path.join(output, 'memory.ndjson')] : [])];
const run = {name, dart, dependencies, base, entry, head, versions, args, node: process.version,
  cliSha256: sha256(cli), entrySha256: sha256(entry), lockSha256: sha256(path.join(dart, 'package-lock.json')),
  buildSha256: buildHash.digest('hex'),
  startedAt: new Date().toISOString(), killed: false};
const log = fs.openSync(path.join(output, 'analysis.log'), 'wx');
const start = performance.now();
const child = spawn(process.execPath, args, {cwd: dart, windowsHide: true, stdio: ['ignore', log, log]});
const deadline = setTimeout(() => {run.killed = true; child.kill();}, 120000);
child.on('error', error => {run.error = String(error);});
child.on('close', (code, signal) => {
  clearTimeout(deadline);
  fs.closeSync(log);
  Object.assign(run, {code, signal, elapsedMs: Math.round(performance.now() - start)});
  fs.writeFileSync(path.join(output, 'run.json'), JSON.stringify(run, null, 2) + '\n');
  const summary = summarizeDart(output);
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({name, status: summary.status, elapsedMs: summary.elapsedMs,
    analysisMs: summary.analysisMs, memoryMB: summary.memoryMB, warnings: summary.warnings,
    memoryLimitReached: summary.memoryLimitReached, finalizationStatus: summary.finalizationStatus,
    actualCloseCallConnected: summary.actualCloseCallConnected,
    incoming: summary.closeViewInstance?.incoming.length, closeCallTargets: summary.closeCall?.targets.length,
    outOfScopeFiles: summary.outOfScopeFiles?.length, selectionError: summary.selectionError,
    heapOutOfMemory: summary.heapOutOfMemory}, null, 2));
  process.exitCode = summary.status === 'completed' && !summary.selectionError &&
    summary.outOfScopeFiles.length === 0 ? 0 : 1;
});
