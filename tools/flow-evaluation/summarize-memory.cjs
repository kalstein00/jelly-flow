const fs = require('node:fs');
const records = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const mib = bytes => Math.round(bytes / 1048576);
const compact = r => ({...r, heapUsedMB: mib(r.heapUsed), rssMB: mib(r.rss)});
const modules = new Map();
for (const r of records) {
  if (r.phase === 'parse:start') modules.set(r.module, r);
  if (r.phase === 'traversal:end' && modules.has(r.module)) {
    const start = modules.get(r.module);
    modules.set(r.module, {module: r.module, heapDeltaMB: mib(r.heapUsed - start.heapUsed),
      durationMs: r.elapsedMs - start.elapsedMs});
  }
}
console.log(JSON.stringify({samples: records.length, last: compact(records.at(-1)),
  peak: compact(records.reduce((a,b) => a.heapUsed > b.heapUsed ? a : b)),
  propagationStart: records.filter(r => r.phase.endsWith(':start') && r.phase.startsWith('propagation')).map(compact),
  largestModuleDeltas: [...modules.values()].filter(r => r.heapDeltaMB !== undefined)
    .sort((a,b) => b.heapDeltaMB - a.heapDeltaMB).slice(0, 8)}, null, 2));
