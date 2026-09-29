# Analysis evidence v1 — integration proposal

Status: proposed output contract for bounded evaluation artifacts. This does not
change Jelly's existing callgraph JSON or integrate a DART production collector.

The OOM follow-up adds optional diagnostic metadata (`memoryLimitReached`,
`terminationPhase`, `finalizationStatus`, `statisticsStatus`) without changing v1
relations or termination values. Missing fields on older artifacts mean unknown.
A memory stop or incomplete finalization cannot be classified as completed.
Raw analyzer diagnostics emit `null` for uncomputed call/reachability statistics.
`graphOutputStatus` must be `complete` when present before consuming a graph:
an older file may remain after an interrupted atomic replacement. Diagnostics-only
runs cannot be exported as selected graph evidence by this adapter.

App-only artifacts additionally carry `analysisScope` (explicit root; external
implementations excluded) and optional `implementationAnalyzed` on return-transfer
relations. Missing metadata on historical artifacts stays unknown. Completed app-only
analysis must not be presented as completed analysis of dependency implementations.
Raw diagnostics list excluded modules and resolved CSS/JSON resource imports;
JSON strings are data, and dynamically executing strings is outside this coverage.

## Meaning

Consumers must distinguish analyzer termination from graph completeness.
`termination` is `completed`, `partial`, or `failed`; `coverage` remains `bounded`.
Successful termination never means all JavaScript calls have been discovered.

Every artifact records the source snapshot, entry, basedir and dependency realpath,
analyzer reference, enabled options, graph digest (when present), budget, diagnostics,
and the fact that the relation list is only a **selection**, not a full graph.
Location files are relative to `source.basedir`, with `/` separators. Source ranges
are 1-based, including columns, and are meaningful only with that
source snapshot. Numeric Jelly IDs are run-local and must not be persisted as
cross-run identities. Changing schema meaning requires a schema version bump.

## Relation kinds

| Kind | Meaning | Required evidence | Forbidden interpretation |
|---|---|---|---|
| `may-call` | A static analyzer resolved a possible target of a syntactic call | callsite and target ranges, raw graph digest | proof of runtime execution, reachability, or a direct call without inference |
| `return-transfer` | A library model transfers an argument value to the call result | model ID/version, application callsite, argument index | the library invokes the callback |
| `registration` | A value is passed/stored as a handler | registration site and target evidence | eventual execution of the handler |
| `unresolved` | A selected source call has no resolved static target | callsite and reason | proof that the function cannot be called, or a zero-valued complete graph |

The current evaluator emits `may-call`, `return-transfer`, and selected
`unresolved` observations. Registration/JSX prop extraction is **not implemented**;
coverage metadata must say `unavailable`, rather than an empty list meaning none.

Jelly does not retain per-edge propagation provenance. Consequently `may-call`
records use `attribution: "unclassified"`. Do not relabel all edges in a model-enabled
run as model-inferred, or describe edges as purely syntactic/direct. An A/B-added
edge is correlated with the model configuration, not a reconstructed derivation.
Only the model's actual argument-to-return transfer has `return-transfer` evidence.
Native/external/escape heuristics may also participate in resolving callees.

## Failure and partial results

`failed` artifacts use `relations: null` and `graphSha256: null`, even if an
interrupted process left a file behind. No graph validity is inferred from file
existence. Diagnostics absent after OOM remain null, never zero-filled.
`partial` artifacts may include selected relations only when readable output
exists, and must retain timeout/aborted/errors/pending-token indicators.
Malformed locations, missing selected functions, and out-of-scope files are
validation failures; they cannot silently become successful negative controls.

Counters such as unresolved calls and warnings are analyzer diagnostics, not a
complete inventory of missing relations. Unsupported versions/subpaths, dynamic
loading, IPC, event execution, and library mutation remain limitations even when
all selected checks pass. The registration category stays unavailable until a
separate collector implements and verifies it.

## Integration gate

The hook comparison proves a narrow improvement: the real call at line 483 can
resolve the callback at line 430, with existing internal targets preserved. This
permits a bounded prototype consumer that shows its entry/scope/limitations.
Adopting a whole-renderer production collector requires separate acceptance of
renderer budget results and unresolved coverage. It must not automatically clear
DART's previous unavailable/prior-comparison diagnostics.

Electron IPC and DART-specific rules require independent evidence and a separate
change. No claim of dynamic execution or exact model attribution should be added
to work around an unsupported field.

The executable shape is [analysis-evidence-v1.ts](analysis-evidence-v1.ts).
Examples generated from the recorded runs live in `docs/baseline/evidence-v1/`.
