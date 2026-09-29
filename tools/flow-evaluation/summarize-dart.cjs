const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function summarizeDart(directory) {
  const read = file => JSON.parse(fs.readFileSync(path.join(directory, file)));
  const run = read('run.json');
  const result = {name: run.name, status: 'failed', elapsedMs: run.elapsedMs, code: run.code,
    killed: run.killed, graphProduced: fs.existsSync(path.join(directory, 'graph.json')),
    diagnosticsProduced: fs.existsSync(path.join(directory, 'diagnostics.json'))};
  if (result.diagnosticsProduced) {
    const d = read('diagnostics.json');
    Object.assign(result, {memoryLimitReached: d.memoryLimitReached, memoryLimitMB: d.memoryLimitMB,
      terminationPhase: d.terminationPhase, finalizationStatus: d.finalizationStatus,
      statisticsStatus: d.statisticsStatus, graphOutputStatus: d.graphOutputStatus,
      waveLimitReached: d.waveLimitReached, indirectionsLimitReached: d.indirectionsLimitReached});
  }
  if (run.code !== 0 || run.killed || run.error || !result.graphProduced || !result.diagnosticsProduced ||
      (result.graphOutputStatus !== undefined && result.graphOutputStatus !== 'complete')) {
    result.heapOutOfMemory = /heap out of memory/i.test(fs.readFileSync(path.join(directory, 'analysis.log'), 'utf8'));
    return result;
  }
  const raw = fs.readFileSync(path.join(directory, 'graph.json'));
  const graph = JSON.parse(raw), d = read('diagnostics.json');
  Object.assign(result, {graphSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    modules: d.modules, functions: d.functions, analysisMs: d.analysisTime, memoryMB: d.maxMemoryUsage,
    errors: d.errors, warnings: d.warnings, timeout: d.timeout, aborted: d.aborted,
    unprocessedTokens: d.unprocessedTokensSize, libraryModels: d.libraryModels ?? []});
  result.status = d.timeout || d.aborted || d.memoryLimitReached || d.errors !== 0 ||
    d.unprocessedTokensSize !== 0 || d.waveLimitReached > 0 || d.indirectionsLimitReached > 0 ||
    (d.finalizationStatus !== undefined && d.finalizationStatus !== 'complete') ||
    (d.statisticsStatus !== undefined && d.statisticsStatus !== 'complete') ? 'partial' : 'completed';
  const locate = location => {
    const [file, line, column, endLine, endColumn] = location.split(':').map(Number);
    return {file: graph.files[file].replaceAll('\\', '/'), line, column, endLine, endColumn};
  };
  const functions = Object.fromEntries(Object.entries(graph.functions).map(([id, loc]) => [id, locate(loc)]));
  const callbacks = Object.entries(functions).filter(([,loc]) =>
    loc.file.endsWith('/app/useWorkspaceAggregate.ts') && loc.line === 430);
  if (callbacks.length !== 1) {
    result.selectionError = `Expected one closeViewInstance callback, found ${callbacks.length}`;
    return result;
  }
  const callback = Number(callbacks[0][0]);
  result.closeViewInstance = {location: functions[callback],
    incoming: graph.fun2fun.filter(([,to]) => to === callback).map(([from]) => functions[from]),
    outgoing: graph.fun2fun.filter(([from]) => from === callback).map(([,to]) => functions[to])};
  const calls = Object.entries(graph.calls).filter(([,location]) => {
    const loc = locate(location);
    return loc.file.endsWith('/app/useWorkspaceAggregate.ts') && loc.line === 483;
  });
  if (calls.length !== 1) result.selectionError = `Expected one close call at line 483, found ${calls.length}`;
  else {
    result.closeCall = {location: locate(calls[0][1]),
      targets: graph.call2fun.filter(([from]) => from === Number(calls[0][0])).map(([,to]) => functions[to])};
    result.actualCloseCallConnected = graph.call2fun.some(([from,to]) => from === Number(calls[0][0]) && to === callback);
  }
  const inside = (file, base) => {
    const relative = path.relative(base, file);
    return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
  };
  result.outOfScopeFiles = graph.files.filter(file => {
    const absolute = path.resolve(run.base, file);
    return !inside(absolute, run.dart) && !inside(absolute, run.dependencies);
  });
  return result;
}
module.exports = {summarizeDart};
if (require.main === module) console.log(JSON.stringify(summarizeDart(process.argv[2]), null, 2));
