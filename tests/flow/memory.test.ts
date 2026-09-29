import {mkdtempSync, readFileSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import Solver from "../../src/analysis/solver";
import {analyzeFiles} from "../../src/analysis/analyzer";
import {AnalysisStateReporter} from "../../src/output/analysisstatereporter";
import {options, resetOptions} from "../../src/options";
import logger from "../../src/misc/logger";

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
