# CLI execution and graph queries

The analyzer checkout owns its CLI/schema. These instructions were checked against jelly-flow `56feb2a`; when flags or schemas differ, inspect that checkout's `src/main.ts`, `src/typings/callgraph.ts`, and `docs/contracts/analysis-evidence-v1.md` before proceeding.

## Setup and execution

Resolve `ANALYZER`, `TARGET`, `ENTRY` and a new `OUT` directory to absolute paths. Run setup in `ANALYZER`. Use the Node requirement in its package.json (the checked revision requires >=22). Keep existing user changes and the lockfile. Install only when dependencies are missing; rebuild after analyzer source changes or when build provenance is unknown.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
node node_modules/typescript/bin/tsc --build tsconfig-build.json
node lib/main.js --help
```

Check each exit code before continuing. The direct TypeScript build avoids the package's POSIX `chmod` step on Windows. A failed setup remains a blocker. No copied Jelly package exists in DART's library-docs lock at the checked revision; the local fork's CLI, source and contract are the relevant authority.

Run from `TARGET`, using resolved paths in this command template (substitute each placeholder, including the path within ANALYZER):

```powershell
node --max-old-space-size=4096 "ANALYZER/lib/main.js" --basedir "TARGET" --app-only "TARGET" --map-keys --timeout 90 --no-print-progress --no-tty --callgraph-json "OUT/graph.json" --diagnostics-json "OUT/diagnostics.json" "ENTRY" 1> "OUT/stdout.log" 2> "OUT/stderr.log"
```

Create OUT first and require the output files not to exist. Capture `$LASTEXITCODE` immediately. On POSIX shells preserve `$?` instead. Record the effective command, identities and result in `OUT/run.json` or the existing task record. Do not use `tools/flow-evaluation/run-dart.cjs` for arbitrary checkouts: that historical runner pins a DART commit and source positions. Do not change the target's dependency versions to satisfy a model; report missing target dependencies and use its own installation policy if preparation is authorized.

`--app-only` excludes external implementations but still resolves package metadata. At the checked revision it automatically models public React 18.3.1 `useCallback`; `--react-callback-model` belongs to the separate dependency-inclusive mode. Other React versions and `useMemo`/`useEffect` semantics are not covered by that model. `--map-keys` separates literal keys while retaining conservative unknown-key behavior. Inspect diagnostics `libraryModels`, `excludedModules` and `resourceImports` for the actual run. Resolved CSS/JSON resources are not executable implementation coverage.

## Completion gate

Inspect these fields without zero-filling missing values:

| Fields | Completed requirement |
| --- | --- |
| process exit | 0 |
| graphOutputStatus, finalizationStatus, statisticsStatus | all `complete` |
| timeout, aborted, memoryLimitReached | all `false` |
| errors, unprocessedTokensSize, waveLimitReached, indirectionsLimitReached | all 0 |
| graph.scope and diagnostics.scope | app-only, matching explicit root, externalImplementations false |

Warnings remain reported even when termination completes. Valid graph serialization with incomplete analysis permits partial evidence with explicit limits; a failed process or incomplete serialization does not. Report sampled `maxMemoryUsage` as sampled heap, not peak RSS.

## Bounded queries

Use the validated JSON directly; no symbol database, server or custom wrapper is needed. Raw graph IDs are local to this run. Locations encode `fileIndex:startLine:startColumn:endLine:endColumn`, with 1-based lines/columns; `files[fileIndex]` is relative to the recorded basedir. Resolve it against that basedir, not the analyzer or output directory.

- `functions` maps IDs to function/module-body locations, not names. Use source to identify names and distinguish nested functions/module bodies.
- `calls` maps callsite IDs to locations.
- `fun2fun` pairs are caller-function ID to callee-function ID. For callers filter the second ID; for callees filter the first.
- `call2fun` pairs are callsite ID to callee-function ID. For evidence of calls targeting a selected function, filter the second ID and decode `calls[first]`. These are different ID spaces.
- Do not assign outgoing callsites to a function solely by enclosing line range: nested functions overlap. Report function edges and callsite edges separately unless source establishes ownership.

This PowerShell example lists up to 20 incoming callsites for a function selected by exact file/start line/start column. Set `$graphPath`, `$selectedFile` (basedir-relative, slash-normalized), `$selectedLine`, and `$selectedColumn` from the verified source. Run only after the completion/scope gate above.

```powershell
$graph = Get-Content -LiteralPath $graphPath -Raw | ConvertFrom-Json
$matches = @($graph.functions.PSObject.Properties | Where-Object {
    $loc = $_.Value.Split(':')
    $graph.files[[int]$loc[0]].Replace('\', '/') -eq $selectedFile -and
        [int]$loc[1] -eq $selectedLine -and [int]$loc[2] -eq $selectedColumn
})
if ($matches.Count -ne 1) { throw "Expected one function; found $($matches.Count)" }
$functionId = [int]$matches[0].Name
$incoming = @($graph.call2fun | Where-Object { $_[1] -eq $functionId })
$rows = @($incoming | Select-Object -First 20 | ForEach-Object {
    $callId = [string]$_[0]
    $loc = $graph.calls.PSObject.Properties[$callId].Value.Split(':')
    [pscustomobject]@{
        file = $graph.files[[int]$loc[0]]
        line = [int]$loc[1]
        column = [int]$loc[2]
        relation = 'may-call'
    }
})
[pscustomobject]@{
    total = $incoming.Count
    truncated = $incoming.Count -gt 20
    callsites = $rows
} | ConvertTo-Json -Depth 5
```

On other hosts use the same schema with the available JSON tooling. A zero-row result means no incoming edge resolved in this graph, not an uncalled function. For multi-hop questions, track visited IDs, start with depth 2 and at most 20 emitted edges, and report truncation. Do not infer test coverage or runtime reachability from static paths.
