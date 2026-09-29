import {mkdtempSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import Solver from "../../src/analysis/solver";
import {analyzeFiles} from "../../src/analysis/analyzer";
import {options, resetOptions} from "../../src/options";
import logger from "../../src/misc/logger";

afterEach(() => resetOptions());
test.each([false, true])("separates existing CSS/JSON from JS but keeps missing imports as errors (missing=%s)", async missing => {
    resetOptions();
    const root = mkdtempSync(path.join(tmpdir(), "jelly-app-resources-"));
    writeFileSync(path.join(root, "package.json"), '{"name":"app","version":"1.0.0"}');
    writeFileSync(path.join(root, "theme.css"), "body { color: red; }");
    writeFileSync(path.join(root, "data.json"), '{"label":"hello"}');
    writeFileSync(path.join(root, "main.ts"), 'import "./theme.css"; import data from "./data.json"; export function app() { return data; }' +
        (missing ? 'import "./absent.css"; import "./absent.js";' : ''));
    options.basedir = options.appOnly = root;
    options.loglevel = logger.transports[0].level = "error";
    const solver = new Solver();
    await analyzeFiles(["main.ts"], solver);
    expect(solver.globalState.filesAnalyzed).toHaveLength(1);
    expect(solver.diagnostics.resourceImports?.map(r => r.kind).sort()).toEqual(["css", "json"]);
    expect(solver.diagnostics.errors).toBe(missing ? 2 : 0);
});
