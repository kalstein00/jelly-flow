# jelly-flow baseline evaluation

Run from the repository root with Node >=22 (recorded run: 24.20.0).
This performs static analysis only. Fixtures are unchanged copies of the DART
evaluation; their local `useCallback` identity example is not a React model.

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tests/flow --ignore-scripts --no-audit --no-fund
node node_modules/typescript/bin/tsc --build tsconfig-build.json
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/flow/jelly.test.ts

$resultDir = 'tmp/flow-evaluation-new-run'
foreach ($caseName in @('baseline', 'negative', 'react', 'react-no-external')) {
    node tools/flow-evaluation/run.cjs lib/main.js $resultDir $caseName
    if ($LASTEXITCODE -ne 0) { throw "Evaluation failed: $caseName" }
}
```

Use a fresh result directory. Each case creates its own directory and refuses
to overwrite it. The CLI can also point at a separately installed npm Jelly
0.13.0 for comparison. Install that reference in a separate directory using
`npm install --prefix <reference-directory> --ignore-scripts --no-audit --no-fund --save-exact @cs-au-dk/jelly@0.13.0`.
Keep its generated lockfile; the package version alone does not pin transitive dependencies.

Each run retains graph JSON, diagnostics, stdout/stderr, invocation metadata,
source/lock/fixture hashes and a selected-edge summary. Defaults are 4096MB
old-space, 90s Jelly timeout, and 120s child-process deadline. No approximate
interpretation, dynamic execution, dependency exclusion, or increased heap.
React and ReactDOM must both appear in the analyzed files.

`completed` means the analyzer terminated without timeout/abort/errors/pending
tokens; it does **not** claim a complete or sound call graph. `selectedChecksPassed`
covers expected positive edges and unrelated-function controls. Known Map
false positives are reported separately and remain defects. In Jest these are
ordinary negative tests with `options.mapKeys = true`. The initial 01 commit
used `test.failing`; 03 removed `.failing` after the key model fixed both defects.

The new models are opt-in and independent:

```powershell
node tools/flow-evaluation/run.cjs lib/main.js tmp/flow-model-run negative --map-keys
node tools/flow-evaluation/run.cjs lib/main.js tmp/flow-model-run react --react-callback-model --map-keys
```

`--react-callback-model` adds return transfers for React 18.3.1's public entry
without replacing library analysis. `--map-keys` separates primitive literal
keys with conservative unknown-key fallback. See work items 02/03 for limits.

Selected source positions belong only to these frozen fixtures. The selector
requires a unique single-line function and distinguishes method columns from
implicit constructors. Missing/ambiguous functions fail selection; they cannot
silently satisfy a negative assertion. JSX prop transfer is not asserted to be
event execution.

Re-read saved results without running analysis:

```powershell
node tools/flow-evaluation/summarize.cjs tmp/flow-evaluation-new-run/react
```

The original handoff/report and selected results are under `docs/baseline`.
Current baseline results and next steps are in
[01-baseline.md](../../docs/work-items/01-baseline.md).
Full-suite tests for unrelated dynamic/approximate/native integrations may need
additional environments; the focused commands above do not install those.
