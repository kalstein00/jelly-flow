import {mkdtempSync, readFileSync, readdirSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import Solver from "../../src/analysis/solver";
import {analyzeFiles} from "../../src/analysis/analyzer";
import {AnalysisStateReporter} from "../../src/output/analysisstatereporter";
import {options, resetOptions} from "../../src/options";
import logger from "../../src/misc/logger";
import {saveAnalysisOutputs} from "../../src/output/bounded";
import {MemoryBudgetException} from "../../src/analysis/budget";

afterEach(() => resetOptions());
test("memory tracing preserves graph and writes parseable phase records without overwriting", async () => {
    resetOptions();
    options.basedir = path.resolve("tests/flow");
    options.mapKeys = true;
    options.loglevel = logger.transports[0].level = "error";
    const files = ["fixtures/map-keys.ts"];
    const plain = new Solver();
    await analyzeFiles(files, plain);
    const file = path.join(mkdtempSync(path.join(tmpdir(), "jelly-memory-")), "memory.ndjson");
    options.memoryTrace = file;
    const traced = new Solver();
    await analyzeFiles(files, traced);
    const graph = (s: Solver) => {
        const {time, ...g} = new AnalysisStateReporter(s.fragmentState).callGraphToJSON(files);
        return g;
    };
    expect(graph(traced)).toEqual(graph(plain));
    const records = readFileSync(file, "utf8").trim().split("\n").map(s => JSON.parse(s));
    expect(records.map(r => r.phase)).toEqual(expect.arrayContaining([
        "parse:start", "def-use:end", "traversal:end", "finalization:getter-index", "statistics:end",
    ]));
    expect(records.every(r => r.heapUsed > 0 && r.rss > 0 && r.tokens >= 0)).toBe(true);
    const before = readFileSync(file, "utf8");
    const other = new Solver();
    expect(() => other.memoryTrace.checkpoint(other, "test")).toThrow();
    expect(readFileSync(file, "utf8")).toBe(before);
});

test("low heap budget stops cooperatively and persists null skipped statistics", async () => {
    resetOptions();
    const directory = mkdtempSync(path.join(tmpdir(), "jelly-budget-"));
    options.basedir = path.resolve("tests/flow");
    options.maxHeapMb = 1;
    options.diagnosticsJson = path.join(directory, "diagnostics.json");
    options.callgraphJson = path.join(directory, "graph.json");
    const solver = new Solver();
    await analyzeFiles(["fixtures/map-keys.ts"], solver);
    expect(solver.diagnostics.memoryLimitReached).toBe(true);
    expect(solver.diagnostics.finalizationStatus).toBe("skipped");
    saveAnalysisOutputs(solver, ["fixtures/map-keys.ts"]);
    const d = JSON.parse(readFileSync(options.diagnosticsJson, "utf8"));
    expect(d.reachableFunctions).toBeNull();
    expect(d.callsWithNoCallee).toBeNull();
    expect(d.statisticsStatus).toBe("not-computed");
    expect(d.graphOutputStatus).not.toBe("pending");
});

test("expired analysis skips finalization, even without a heap budget", async () => {
    resetOptions();
    options.basedir = path.resolve("tests/flow");
    options.timeout = 1;
    const solver = new Solver();
    solver.globalState.timeoutTimer.startTime -= 2000000000n;
    await analyzeFiles(["fixtures/map-keys.ts"], solver);
    expect(solver.diagnostics.timeout).toBe(true);
    expect(solver.diagnostics.finalizationStatus).toBe("skipped");
});

test("interrupted serialization preserves previous graph and closes/removes temporary output", () => {
    resetOptions();
    const directory = mkdtempSync(path.join(tmpdir(), "jelly-output-"));
    const file = path.join(directory, "graph.json");
    writeFileSync(file, "previous-result");
    const out = new AnalysisStateReporter(new Solver().fragmentState);
    let checks = 0;
    expect(() => out.saveCallGraph(file, Array(1500).fill("entry.js"), () => {
        if (++checks === 2) throw new MemoryBudgetException("serialization", 10);
    })).toThrow(MemoryBudgetException);
    expect(readFileSync(file, "utf8")).toBe("previous-result");
    expect(readdirSync(directory)).toEqual(["graph.json"]);
});

test("a budget interrupted during finalization is recorded instead of escaping", async () => {
    resetOptions();
    options.basedir = path.resolve("tests/flow");
    const solver = new Solver();
    const original = solver.memoryBudget.check.bind(solver.memoryBudget);
    solver.memoryBudget.check = (phase, force, reserve) => {
        if (phase === "finalization:property-reads") throw new MemoryBudgetException(phase, 123);
        original(phase, force, reserve);
    };
    await analyzeFiles(["fixtures/map-keys.ts"], solver);
    expect(solver.diagnostics.memoryLimitReached).toBe(true);
    expect(solver.diagnostics.finalizationStatus).toBe("interrupted");
    expect(solver.diagnostics.statisticsStatus).toBe("not-computed");
});

test("diagnostics survive an unexpected failure at finalization entry", async () => {
    resetOptions();
    options.basedir = path.resolve("tests/flow");
    options.diagnosticsJson = path.join(mkdtempSync(path.join(tmpdir(), "jelly-checkpoint-")), "diagnostics.json");
    const solver = new Solver();
    solver.memoryBudget.check = phase => {
        if (phase === "finalization:start") throw new Error("injected finalization failure");
    };
    await expect(analyzeFiles(["fixtures/map-keys.ts"], solver)).rejects.toThrow("injected finalization failure");
    const d = JSON.parse(readFileSync(options.diagnosticsJson, "utf8"));
    expect(d.functions).toBeGreaterThan(0);
    expect(d.finalizationStatus).toBe("not-started");
    expect(d.statisticsStatus).toBe("not-computed");
    expect(d.reachableFunctions).toBeNull();
});
