import {mkdtempSync, mkdirSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import {analyzeFiles} from "../../src/analysis/analyzer";
import Solver from "../../src/analysis/solver";
import {options, resetOptions} from "../../src/options";
import {AnalysisStateReporter} from "../../src/output/analysisstatereporter";
import logger from "../../src/misc/logger";

describe("explicit app source scope", () => {
    let root: string, solver: Solver;
    beforeAll(async () => {
        resetOptions();
        root = mkdtempSync(path.join(tmpdir(), "jelly-app-scope-"));
        const put = (file: string, content: string) => {
            const target = path.join(root, file);
            mkdirSync(path.dirname(target), {recursive: true});
            writeFileSync(target, content);
        };
        put("app/package.json", '{"name":"app","version":"1.0.0"}');
        put("app/main.js", 'const {local} = require("./local"); const {shared} = require("./workspace/shared"); require("vendor"); require("../app-other/out"); export function run() { local(); shared(); }');
        put("app/local.js", 'exports.local = function local() {};');
        put("app/workspace/package.json", '{"name":"workspace","version":"1.0.0"}');
        put("app/workspace/shared.js", 'exports.shared = function shared() {};');
        put("app/node_modules/vendor/package.json", '{"name":"vendor","version":"1.0.0","main":"index.js"}');
        put("app/node_modules/vendor/index.js", 'exports.vendorImplementation = function vendorImplementation() {};');
        put("app-other/out.js", 'exports.outside = function outside() {};');
        options.basedir = root;
        options.appOnly = path.join(root, "app");
        options.loglevel = logger.transports[0].level = "error";
        solver = new Solver();
        await analyzeFiles(["app/main.js"], solver);
    });
    afterAll(() => resetOptions());
    test("keeps local and owned shared source calls", () => {
        const functions = [...solver.globalState.functionInfos.values()];
        const run = functions.find(f => f.name === "run")!;
        expect([...solver.fragmentState.functionToFunction.get(run)!].map(f => f.name).sort()).toEqual(["local", "shared"]);
        expect(solver.diagnostics.errors).toBe(0);
    });
    test("never traverses external implementation or a sibling with the same path prefix", () => {
        expect(solver.globalState.filesAnalyzed.map(file => path.relative(root, file).replaceAll("\\", "/")).sort())
            .toEqual(["app/local.js", "app/main.js", "app/workspace/shared.js"]);
    });
    test("labels graph scope separately from termination", () => {
        const graph = new AnalysisStateReporter(solver.fragmentState).callGraphToJSON(["app/main.js"]);
        expect(graph.scope).toEqual(solver.diagnostics.scope);
        expect(graph.scope?.externalImplementations).toBe(false);
    });
    test("rejects an entry outside the chosen app root", async () => {
        await expect(analyzeFiles(["app-other/out.js"], new Solver())).rejects.toThrow("Entry outside app-only");
    });
});
