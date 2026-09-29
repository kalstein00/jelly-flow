const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = process.argv[2];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const runs = ['final-hook', 'final-1', 'final-2', 'final-3'].map(name => {
  const directory = path.join(root, name, name === 'final-hook' ? 'hook' : 'renderer');
  const run = read(path.join(directory, 'run.json'));
  const {libraryModels, ...summary} = read(path.join(directory, 'summary.json'));
  const diagnostics = read(path.join(directory, 'diagnostics.json'));
  const {time, ...graph} = read(path.join(directory, 'graph.json'));
  assert.equal(summary.status, 'completed');
  assert.equal(summary.errors, 0);
  assert.equal(summary.unprocessedTokens, 0);
  assert.equal(summary.actualCloseCallConnected, true);
  assert.equal(summary.closeCall.targets.length, 1);
  assert.deepEqual(summary.outOfScopeFiles, []);
  assert.equal(graph.scope.kind, 'app-only');
  assert.equal(graph.scope.root, run.dart);
  assert.equal(graph.scope.externalImplementations, false);
  assert(graph.files.every(file => !file.replaceAll('\\', '/').includes('/node_modules/')));
  assert(libraryModels.length > 0 && libraryModels.every(model => model.implementationAnalyzed === false));
  for (const line of [113, 341])
    assert(summary.closeViewInstance.outgoing.some(loc => loc.file.endsWith('/workspaceAggregateProjection.ts') && loc.line === line));
  assert(summary.closeViewInstance.outgoing.some(loc => loc.file.endsWith('/useWorkspaceAggregate.ts') && loc.line === 101));
  return {name, directory, run, summary,
    graphWithoutTimestampSha256: crypto.createHash('sha256').update(JSON.stringify(graph)).digest('hex'),
    excludedModules: diagnostics.excludedModules,
    resourceCounts: {css: diagnostics.resourceImports.filter(r => r.kind === 'css').length,
      json: diagnostics.resourceImports.filter(r => r.kind === 'json').length},
    models: libraryModels.map(({calls, ...model}) => ({...model, callsApplied: calls.length}))};
});
const renderer = runs.slice(1);
assert.equal(new Set(runs.map(r => r.run.buildSha256)).size, 1);
assert.equal(new Set(renderer.map(r => r.graphWithoutTimestampSha256)).size, 1);
const wall = renderer.map(r => r.run.elapsedMs).sort((a,b) => a-b);
console.log(JSON.stringify({date: '2026-09-29', scope: 'app-only', rendererCompletedRuns: 3,
  sameBuild: true, rendererGraphsEqualWithoutTimestamp: true,
  wallMs: {min: wall[0], median: wall[1], max: wall[2]}, runs,
  limitations: ['External library implementations are excluded by user choice.',
    'Only React 18.3.1 public useCallback has a precise external return model.',
    'Other external APIs remain opaque; callback may-call edges do not prove event execution.',
    'CSS/JSON resources and dynamic code stored in strings are not analyzed as JS functions.',
    'Completed termination does not establish graph completeness.'],
}, null, 2));
