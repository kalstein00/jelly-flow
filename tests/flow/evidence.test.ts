import {buildEvidence, DartRun, DartSummary} from "../../tools/flow-evaluation/export-evidence";

const run: DartRun = {head: "snapshot", entry: "entry.ts", base: "C:/source", dependencies: "C:/deps",
    lockSha256: "lock", cliSha256: "cli", node: "v24.20.0", args: ["heap", "cli", "entry.ts"],
    code: 0, killed: false};
const callsite = {file: "hook.ts", line: 483, column: 17};
const summary: DartSummary = {status: "completed", graphSha256: "digest", outOfScopeFiles: [],
    errors: 0, warnings: 968, timeout: false, aborted: false, unprocessedTokens: 0,
    closeCall: {location: callsite, targets: []}};

test("failed run never becomes a zero-edge graph, even with residual graph data", () => {
    const result = buildEvidence({...run, code: 134}, {...summary, status: "failed", heapOutOfMemory: true}, "ref");
    expect(result.termination).toBe("failed");
    expect(result.relations).toBeNull();
    expect(result.graphSha256).toBeNull();
    expect(result.diagnostics).toBeNull();
});
test("unresolved static target is explicit and coverage remains bounded", () => {
    const result = buildEvidence(run, summary, "ref");
    expect(result.coverage).toBe("bounded");
    expect(result.registrationCoverage).toBe("unavailable");
    expect(result.relations).toEqual([{kind: "unresolved", callsite, reason: "no-static-target"}]);
});
test("return transfer is distinct from possible call and does not claim edge provenance", () => {
    const target = {file: "hook.ts", line: 430, column: 5};
    const result = buildEvidence(run, {...summary, closeCall: {location: callsite, targets: [target]},
        libraryModels: [{model: "react.useCallback/1", version: "18.3.1", argument: 0,
            calls: ["C:\\source\\hook.ts:429:29"]}]}, "ref");
    expect(result.relations).toEqual([
        {kind: "may-call", callsite, target, attribution: "unclassified"},
        {kind: "return-transfer", model: "react.useCallback/1", version: "18.3.1", argument: 0,
            callsite: {file: "hook.ts", line: 429, column: 29}},
    ]);
});
test("partial output retains diagnostics and partial status", () => {
    const result = buildEvidence(run, {...summary, status: "partial", timeout: true}, "ref");
    expect(result.termination).toBe("partial");
    expect(result.diagnostics?.timeout).toBe(true);
});
test("process failure cannot masquerade as completed analysis", () => {
    expect(() => buildEvidence({...run, code: 134}, summary, "ref")).toThrow();
});
test.each([
    {selectionError: "missing function"}, {outOfScopeFiles: ["elsewhere.ts"]},
    {warnings: undefined}, {timeout: true},
    {memoryLimitReached: true}, {finalizationStatus: "skipped"}, {waveLimitReached: 1},
    {graphOutputStatus: "pending"},
])("rejects invalid evidence %j", patch => {
    expect(() => buildEvidence(run, {...summary, ...patch}, "ref")).toThrow();
});
