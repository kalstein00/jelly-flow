import path from "path";
import Solver from "../../src/analysis/solver";
import {analyzeFiles} from "../../src/analysis/analyzer";
import {options, resetOptions} from "../../src/options";
import {AccessPathToken} from "../../src/analysis/tokens";
import logger from "../../src/misc/logger";
import {mkdtempSync, mkdirSync, writeFileSync} from "fs";
import {tmpdir} from "os";

describe("app-only React export boundary", () => {
    let solver: Solver;
    const named = (name: string) => [...solver.globalState.functionInfos.values()].find(f => f.name === name)!;
    beforeAll(async () => {
        resetOptions();
        options.basedir = path.resolve("tests/flow");
        options.appOnly = path.resolve("tests/flow/fixtures/react-boundary");
        options.loglevel = logger.transports[0].level = "error";
        solver = new Solver();
        await analyzeFiles(["fixtures/react-boundary/index.ts"], solver);
    });
    afterAll(() => resetOptions());
    test.each(["callCjs", "callDestructured"])("keeps %s callback return", caller => {
        expect(solver.fragmentState.functionToFunction.get(named(caller))?.has(named("callback"))).toBe(true);
    });
    test("does not invoke useCallback argument even with external callback edges enabled", () => {
        expect(solver.fragmentState.functionToFunction.get(named("registerOnly"))?.has(named("callback")) ?? false).toBe(false);
    });
    test.each(["unknownNamed", "unknownNamespace", "unknownReexport"])("keeps %s results unknown", name => {
        const fun = [...solver.globalState.functionInfos].find(([, f]) => f === named(name))![0];
        const f = solver.fragmentState;
        expect([...f.getTokens(f.getRepresentative(solver.varProducer.returnVar(fun)))].some(t => t instanceof AccessPathToken)).toBe(true);
    });
    test("records omitted implementation and boundary model", () => {
        expect(solver.globalState.filesAnalyzed).toHaveLength(2);
        expect(solver.diagnostics.libraryModels).toHaveLength(1);
        expect(solver.diagnostics.libraryModels[0].implementationAnalyzed).toBe(false);
        expect(solver.diagnostics.excludedModules?.find(m => m.package === "react")?.modeled).toBe(true);
        expect(solver.diagnostics.errors).toBe(0);
    });
});

test.each([
    ["react", "18.2.0", true], ["not-react", "18.3.1", true], ["react", "18.3.1", false],
])("does not model external %s@%s with natives=%s", async (name, version, natives) => {
    resetOptions();
    const root = mkdtempSync(path.join(tmpdir(), "jelly-react-boundary-"));
    const dependency = path.join(root, "node_modules/dependency");
    mkdirSync(dependency, {recursive: true});
    writeFileSync(path.join(root, "package.json"), '{"name":"app","version":"1.0.0"}');
    writeFileSync(path.join(dependency, "package.json"), JSON.stringify({name, version, main: "index.js"}));
    writeFileSync(path.join(dependency, "index.js"), "not valid JavaScript: must never parse this implementation");
    writeFileSync(path.join(root, "main.js"), 'import {useCallback} from "dependency"; useCallback(() => {}, []);');
    options.basedir = options.appOnly = root;
    options.natives = natives;
    const solver = new Solver();
    try {
        await analyzeFiles(["main.js"], solver);
        expect(solver.diagnostics.libraryModels).toEqual([]);
        expect(solver.globalState.filesAnalyzed).toHaveLength(1);
        expect(solver.diagnostics.errors).toBe(0);
    } finally {
        resetOptions();
    }
});
