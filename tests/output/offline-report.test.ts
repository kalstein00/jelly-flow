import {mkdtempSync, writeFileSync, readFileSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import {analyzeFiles} from "../../src/analysis/analyzer";
import Solver from "../../src/analysis/solver";
import {options, resetOptions} from "../../src/options";
import {AnalysisStateReporter} from "../../src/output/analysisstatereporter";
import {generateReport, writeReport} from "../../src/report/report";
import {reportFixture} from "./report-fixture";

test("cycles are specific to each relation and crossings respect shared area membership", () => {
    const input = reportFixture();
    input.inventory[1].areas = ["worker"];
    input.runs[0].graph!.fun2fun.push([1, 0]);
    input.imports = [{source: "app/a.ts", target: "shared/b.ts", location: "app/a.ts:1:1", specifier: "../shared/b", typeOnly: true}];
    const model = generateReport(input).model;
    expect(model.edges.filter(e => e.kind === "call").every(e => e.cycle)).toBe(true);
    expect(model.edges.find(e => e.kind === "import")?.cycle).toBe(false);
    expect(model.edges.every(e => e.crossArea)).toBe(true);
});

test("multi-entry coverage merges shared identities and distinguishes uncovered inventory", () => {
    const input = reportFixture();
    input.inventory.push({path: "worker/c.ts", areas: ["worker"]});
    input.runs.push({...input.runs[0], area: "worker"});
    input.runs.push({area: "broken", status: "failed", diagnostics: {error: "budget"}});
    const result = generateReport(input);
    expect(result.model.files.find(f => f.path === "shared/b.ts")).toMatchObject({callers: 1, areas: ["app", "worker"]});
    expect(result.model.files.find(f => f.path === "worker/c.ts")?.status).toBe("unanalyzed");
    expect(result.model.edges[0].count).toBe(1);
    expect(result.model.runs[2].status).toBe("failed");
});

test("invalid generation preserves the previous valid report", () => {
    const output = path.join(mkdtempSync(path.join(tmpdir(), "report-preserve-")), "report.html");
    const input = reportFixture();
    writeReport(input, output);
    const previous = readFileSync(output, "utf8");
    input.runs[0].graph!.fun2fun = [[0, 999]];
    expect(() => writeReport(input, output)).toThrow("Invalid function edge");
    expect(readFileSync(output, "utf8")).toBe(previous);
});

test("real analysis becomes an offline file map with distinct caller and function-pair counts", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "jelly-report-"));
    writeFileSync(path.join(root, "a.ts"), 'import {save} from "./b"; export function run() { save(); save(); }');
    writeFileSync(path.join(root, "b.ts"), 'export function save() {}');
    resetOptions();
    options.basedir = root;
    options.appOnly = root;
    options.loglevel = "error";
    const solver = new Solver();
    await analyzeFiles(["a.ts"], solver);
    const graph = new AnalysisStateReporter(solver.fragmentState).callGraphToJSON(["a.ts"]);
    const result = generateReport({version: 1, snapshot: "fixture", created: "2026-10-08",
        inventory: [{path: "a.ts", areas: ["app"]}, {path: "b.ts", areas: ["app"]}],
        runs: [{area: "app", status: "completed", graph, diagnostics: {warnings: 0}}],
        selection: "all"});
    expect(result.model.files.find(f => f.path === "b.ts")?.callers).toBe(1);
    expect(result.model.edges).toEqual([expect.objectContaining({source: "a.ts", target: "b.ts", count: 1})]);
    expect(result.html).toContain("Possible calls");
    expect(result.html).not.toMatch(/src="https?:|href="https?:/);
    resetOptions();
}, 30000);
