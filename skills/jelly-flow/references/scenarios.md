# Skill validation

## 2026-10-07 — local CLI and query smoke

Documentation/direct route. Analyzer checkout: `C:/Users/kalst/vscode/jelly-flow`, clean revision `56feb2a`. Node `v24.16.0`, Windows PowerShell-compatible command syntax, executed in PowerShell. Preparation ran `npm ci --ignore-scripts --no-audit --no-fund` and `node node_modules/typescript/bin/tsc --build tsconfig-build.json`; both exited 0. CLI help exposed app-only, map-keys and diagnostics-json. Analyzer tracked files stayed unchanged.

Fresh temporary target: `%TEMP%/jelly-flow-skill-e757fcfab0c24377ba418d251e9d19db`. The `output` subdirectory contains graph, diagnostics and logs. These are temporary artifacts; the fixture and invocation below preserve reproduction instructions.

`leaf.ts`:

```typescript
export function save() { return 1; }
export function remove() { return 2; }
export function unrelated() { return 3; }
```

`entry.ts`:

```typescript
import { save as persist, remove } from './leaf';
const handlers = new Map<string, () => number>();
handlers.set('save', persist);
handlers.set('remove', remove);
export function direct() { return persist(); }
export function dispatch() { return handlers.get('save')!(); }
direct();
dispatch();
```

Invocation from the fresh target directory (create output first):

```powershell
node --max-old-space-size=4096 C:/Users/kalst/vscode/jelly-flow/lib/main.js --basedir . --app-only . --map-keys --timeout 90 --no-print-progress --no-tty --callgraph-json output/graph.json --diagnostics-json output/diagnostics.json entry.ts 1> output/stdout.log 2> output/stderr.log
```

Observed exit 0; graph and diagnostics scope match the temporary app root and exclude external implementations. Errors/warnings/pending tokens/wave and indirection limits were 0; timeout/abort/memory stop were false. Finalization, statistics and graph serialization were complete. This establishes bounded fixture analysis, not graph soundness or current DART renderer acceptance.

The PowerShell query block in `cli.md` was extracted and executed unchanged with `graphPath=output/graph.json`, `selectedFile=leaf.ts`, `selectedLine=1`, `selectedColumn=8`. It returned exactly two incoming callsites: `entry.ts:5:35` and `entry.ts:6:37`, with total 2 and truncated false. Raw fun2fun also linked direct and dispatch to save, with no incoming edge to remove or unrelated. Repeating the query with selectedLine 999 failed with `Expected one function; found 0`, rather than reporting an empty successful selection.

Manual trigger review:

| Request | Expected routing | Review result |
| --- | --- | --- |
| Resolve this Map callback's possible target | jelly-flow; inspect graph and source | Covered by description and smoke |
| Find the file declaring queryChartsView | bounded rg | Explicit non-trigger |
| Show Electron IPC execution end-to-end | Separate IPC/source/runtime evidence; Jelly only for local function portions | Explicit limit |
| Refactor all high fan-in modules | Review leads, then separately authorized implementation workflow | No automatic refactor authority |

Not executed: whole DART analysis, React-model validation, architecture-evidence collector integration, runtime execution proof, automated agent-discovery/forward-testing, cross-task cache reuse, or non-Windows commands. These remain distinct from the successful CLI/query smoke.

## 2026-10-07 — subsequent DART renderer analysis

The user then invoked the skill on DART. This subsequent run extends the earlier smoke; it does not change its historical scope. Target HEAD `f6dad3b5b0e5249895e4eaf75f73e7fe27296564`, analyzer `56feb2ae9da6e6be596fd885fed694cddcf59884`, Node 24.16.0, React/ReactDOM 18.3.1. Entry: `log-viewer-app/src/renderer/src/main.tsx`. Basedir/app-only root: the DART dev-branch checkout. Used map-keys, 4096 MiB old-space, 90-second analyzer timeout and an external 120-second process deadline.

Artifacts: `%TEMP%/dart-jelly-20261007-WYQsbU/{run.json,graph.json,diagnostics.json,selected-callbacks.json,stdout.log,stderr.log}`. run.json records the effective command, dirty state, source/config JSON and JS/TS hashes before/after, dependency realpaths/versions, analyzer identity and graph digest. Source snapshot comparison passed. Exit 0; wall time 14,574ms, analysis time 10,849ms, sampled heap 673 MiB. All completion fields passed; 530 modules / 6,663 functions, errors 0, warnings 1,373, external implementations excluded (12 module entries), resource imports 46. React useCallback model recorded 538 sites. Termination completed; coverage remains bounded.

Selected nine callback targets and inspected their source. The aggregate close callback at `useWorkspaceAggregate.ts:430:5` had five incoming callsites: SQL-view replacement `useWorkspaceSqlViewWorkflows.ts:132`, dataset-session close request `useWorkspaceAggregate.ts:483`, and `useWorkspaceTabClosing.ts:29,45,51`. Source confirms the tab-closing callbacks route through the shared mutation callback; graph edges remain static may-call evidence.

Three Charts interaction callbacks at `useChartsExplorerChartInteractions.ts:168,180,186` had no resolved incoming callsites. Source nevertheless passes them through `ChartsExplorerPlace.tsx:653-657`; the visualization panel attaches reset/load handlers to onClick at lines 534/575. This demonstrates why zero graph incoming edges must not be treated as unused UI callbacks. No runtime event execution was tested. Main/preload/worker entries, all callback source relationships, and production collector integration remain outside this run.
