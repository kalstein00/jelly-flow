---
name: jelly-flow
description: Analyze JavaScript/TypeScript possible call relationships with a separate local jelly-flow checkout. Use for callback or Map dispatch targets, bounded callers/callees, and call evidence for architecture review. Use rg for simple symbol lookup; this skill does not refactor code or replace import/type analysis.
---

# Jelly Flow

Answer a bounded call-relationship question using the local analyzer and source evidence. Keep the analyzer outside the target repository and its application dependencies. This is a standalone agent workflow; production architecture-evidence integration is not implemented.

## Resolve and prepare

1. Identify the target repository, question, execution entry, and requested source symbol. Locate the symbol with bounded `rg`, then inspect its definition/imports. Distinguish renderer, main, preload, worker, and test entries; choose the entry that reaches the requested code. A direct module entry answers a narrower question than an application entry.
2. Resolve the analyzer checkout from the user's path or `JELLY_FLOW_ROOT`. If neither is given, check only a `jelly-flow` sibling of the target repository; ask for its location if absent. Paths in an earlier conversation are hints to verify, not portable defaults. Record the actual analyzer revision and dirty state. Do not substitute the npm upstream package: it lacks this fork's app-only behavior.
3. Read [CLI execution and query reference](references/cli.md). Prepare missing analyzer dependencies using its lockfile and build the current checkout. Confirm the required flags through `--help`. Read the checkout's evidence contract when interpreting a new analyzer revision. Missing dependencies or unsupported flags are a preparation failure, not an empty graph.

## Capture, run, validate

4. Create a fresh output directory outside tracked source. Record the target revision, dirty/untracked source state, entries, absolute basedir/app root, Node version, analyzer revision/build identity, lockfile identity, invocation and budgets. Capture content hashes of the target JS/TS sources and resolution inputs (tsconfig/package/lock files, including relevant untracked files) before analysis; compare after analysis. A HEAD alone does not identify a dirty worktree. Record actual dependency realpaths and installed package versions relevant to models. Source changes during analysis invalidate its use as current evidence.
5. Run static `--app-only <target-root> --map-keys` analysis with explicit entry files, graph and diagnostics destinations. Start with 4096 MiB Node old-space and 90 seconds analysis timeout. Keep stdout/stderr and the actual process exit result. Use the host's process monitoring/cancellation for a hung run; the analyzer timeout is cooperative, not a hard wall-clock deadline. Preserve diagnostics and report the stop instead of silently enlarging scope/budgets. Approximate interpretation and dynamic execution are outside this workflow.
6. Validate before querying. A nonzero exit, missing/unreadable output, incomplete graph serialization, or scope mismatch makes the graph unusable for this run. Require `graphOutputStatus: complete` and matching app-only roots in graph/diagnostics. With readable valid output, classify termination as partial when timeout, abort, memory stop, errors, pending tokens, wave/indirection limits, or incomplete finalization/statistics occur. Missing required status fields mean unknown, never completed. Only unchanged inputs and all explicit completion fields passing allow `completed`; coverage remains **bounded** in every case. Hash the consumed graph and keep that digest with the result.

## Query and explain

7. Resolve a function by exact file and source range; use a column when multiple functions share a line. Missing or ambiguous selection is a visible selection failure. Decode raw locations and query only relevant `fun2fun` / `call2fun` edges as described in the reference. Start with one hop and at most 20 relationships. Report total matches and truncation; expand only for an identified unanswered question. Reuse the validated graph within the task while its input identities remain unchanged; across tasks, rerun unless the full recorded identity can be verified.
8. Inspect the returned source definitions and callsites before explaining a relationship. Label graph edges as **possible static relationships**, including module-loading and external/native heuristic edges where applicable. Per-edge propagation provenance is unavailable. A library argument-to-return transfer is not callback execution; A/B-added edges do not establish their exact derivation. Zero edges do not prove dead code or safety. IPC, JSX/event registration/execution, external implementations, and unsupported library models stay unresolved without separate evidence.
9. Return the selected symbol, entry/scope, termination/coverage, bounded relationships with source links, relevant warnings/unresolved cases, and artifact paths. Separate source-confirmed facts from graph possibilities and improvement proposals. High fan-in or a cycle is a review lead, not a defect. Hand evidence to the user's architecture workflow; this skill alone does not authorize refactoring, publishing issues, or changing prior review dispositions.

## Completion

The answer addresses the requested relationship and includes source evidence, or identifies the precise preparation/analysis/selection blocker. Never pass this standalone result off as a completed architecture-evidence scan or clear that scanner's unsupported metrics. Validation of the skill itself is recorded in [scenarios](references/scenarios.md).
