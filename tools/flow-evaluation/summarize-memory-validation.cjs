const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const runs = ['unbounded', 'bounded-1', 'bounded-2', 'bounded-3'].map(name => {
  const directory = path.join(root, name, 'renderer');
  const run = read(path.join(directory, 'run.json'));
  const {libraryModels, ...summary} = read(path.join(directory, 'summary.json'));
  let analyzedFilesDigest = null;
  if (summary.graphProduced && summary.graphOutputStatus === 'complete') {
    const graph = read(path.join(directory, 'graph.json'));
    analyzedFilesDigest = crypto.createHash('sha256').update(JSON.stringify(graph.files.slice().sort())).digest('hex');
  }
  return {name, directory, run, summary, analyzedFilesDigest};
});
const bounded = runs.slice(1);
const same = (items, get) => new Set(items.map(get)).size === 1;
const values = bounded.map(r => r.run.elapsedMs).sort((a,b) => a - b);
const result = {
  date: '2026-09-29', runs,
  sameBuild: same(runs, r => r.run.buildSha256),
  sameInputs: ['entrySha256', 'lockSha256', 'node', 'head', 'dependencies'].every(key => same(runs, r => r.run[key])),
  boundedAnalyzedFilesEqual: same(bounded, r => r.analyzedFilesDigest),
  levelA: bounded.every(r => r.run.code === 0 && !r.run.killed && r.summary.diagnosticsProduced &&
    r.summary.graphOutputStatus === 'complete' && !r.summary.heapOutOfMemory && r.summary.status === 'partial'),
  levelB: runs[0].summary.status === 'completed',
  levelC: bounded.every(r => r.summary.status === 'completed'),
  boundedWallMs: {min: values[0], median: values[1], max: values[2]},
  limitations: [
    'Partial renderer results are not completed analysis or evidence of absent callbacks.',
    'maxMemoryUsage is a sampled heap value, not peak RSS or a physical memory cap.',
    'Prior renderer graphs are unavailable because the baseline crashed; whole-graph equality is unproven.',
  ],
};
console.log(JSON.stringify(result, null, 2));
