const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function summarize(directory) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const run = read('run.json');
  const result = {name: run.name, node: run.node, elapsedMs: run.elapsedMs,
    exitCode: run.code, killed: run.killed, status: 'failed', selectedChecksPassed: false};
  const graphFile = path.join(directory, 'graph.json');
  if (run.error || run.code !== 0 || run.killed || !fs.existsSync(graphFile) ||
      !fs.existsSync(path.join(directory, 'diagnostics.json'))) return result;
  const raw = fs.readFileSync(graphFile);
  const graph = JSON.parse(raw);
  const diagnostics = read('diagnostics.json');
  Object.assign(result, {
    graphSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    modules: diagnostics.modules, functions: diagnostics.functions,
    analysisMs: diagnostics.analysisTime, memoryMB: diagnostics.maxMemoryUsage,
    errors: diagnostics.errors, warnings: diagnostics.warnings,
    timeout: diagnostics.timeout, aborted: diagnostics.aborted,
    unprocessedTokens: diagnostics.unprocessedTokensSize,
  });
  if (diagnostics.libraryModels) result.libraryModels = diagnostics.libraryModels;
  result.status = diagnostics.timeout || diagnostics.aborted || diagnostics.memoryLimitReached || diagnostics.errors !== 0 ||
    diagnostics.unprocessedTokensSize !== 0 || diagnostics.waveLimitReached > 0 || diagnostics.indirectionsLimitReached > 0 ||
    (diagnostics.finalizationStatus !== undefined && diagnostics.finalizationStatus !== 'complete') ||
    (diagnostics.statisticsStatus !== undefined && diagnostics.statisticsStatus !== 'complete') ? 'partial' : 'completed';
  // "completed" describes termination only, never graph soundness/completeness.
  const locate = (suffix, line) => {
    const matches = Object.entries(graph.functions).filter(([, location]) => {
      const [file, startLine, column, endLine] = location.split(':').map(Number);
      // All selected functions occupy one line. This excludes module bodies;
      // columns distinguish A.run/B.run from synthesized class constructors.
      const methodColumn = suffix === 'leaf.ts' && (line === 2 || line === 3) ? 18 : undefined;
      return graph.files[file].replaceAll('\\', '/').endsWith('/' + suffix) &&
        startLine === line && endLine === line && (methodColumn === undefined || column === methodColumn);
    });
    if (matches.length !== 1) throw new Error(`Expected one function at ${suffix}:${line}, found ${matches.length}`);
    return Number(matches[0][0]);
  };
  const has = (fromFile, fromLine, toFile, toLine) => {
    const from = locate(fromFile, fromLine), to = locate(toFile, toLine);
    return graph.fun2fun.some(([a, b]) => a === from && b === to);
  };
  const incoming = (file, line) => {
    const id = locate(file, line);
    return graph.fun2fun.filter(([, to]) => to === id).length;
  };
  try {
    if (run.name === 'baseline') {
      result.expectedEdges = {
        alias: has('caller.ts', 3, 'leaf.ts', 1),
        reExport: has('caller.ts', 4, 'leaf.ts', 1),
        methodA: has('caller.ts', 5, 'leaf.ts', 2),
        methodB: has('caller.ts', 5, 'leaf.ts', 3),
        parameterCallback: has('caller.ts', 6, 'leaf.ts', 1),
        returnedCallback: has('caller.ts', 10, 'caller.ts', 9),
        callbackBody: has('caller.ts', 9, 'leaf.ts', 1),
        mapCallback: has('caller.ts', 13, 'leaf.ts', 1),
      };
    } else if (run.name === 'negative') {
      result.expectedEdges = {
        saveToSave: has('negative.ts', 6, 'negative.ts', 1),
        removeToRemove: has('negative.ts', 7, 'negative.ts', 2),
      };
      result.knownFalsePositives = {
        saveToRemove: has('negative.ts', 6, 'negative.ts', 2),
        removeToSave: has('negative.ts', 7, 'negative.ts', 1),
      };
      result.unrelatedIncoming = incoming('negative.ts', 8);
    } else if (run.name === 'react' || run.name === 'react-no-external') {
      result.expectedEdges = {
        clickToCallback: has('react.tsx', 12, 'react.tsx', 7),
        callbackToPersist: has('react.tsx', 7, 'react.tsx', 4),
      };
      result.unrelatedIncoming = incoming('react.tsx', 5);
      // Fail if actual React/ReactDOM sources were accidentally excluded.
      result.analyzedDependencies = Object.fromEntries(['react', 'react-dom'].map(pkg => [pkg,
        graph.files.some(file => file.replaceAll('\\', '/').includes(`/node_modules/${pkg}/`))]));
    } else throw new Error(`Unknown case: ${run.name}`);
    result.selectedChecksPassed = Object.values(result.expectedEdges).every(Boolean) &&
      (result.unrelatedIncoming === undefined || result.unrelatedIncoming === 0) &&
      (!result.analyzedDependencies || Object.values(result.analyzedDependencies).every(Boolean));
  } catch (error) {
    result.selectionError = String(error);
  }
  return result;
}

module.exports = {summarize};
if (require.main === module) {
  if (!process.argv[2]) throw new Error('Expected case result directory');
  console.log(JSON.stringify(summarize(path.resolve(process.argv[2])), null, 2));
}
