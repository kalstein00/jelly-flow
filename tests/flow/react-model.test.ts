import path from "node:path";
import {analyzeFiles} from "../../src/analysis/analyzer";
import Solver from "../../src/analysis/solver";
import logger from "../../src/misc/logger";
import {options, resetOptions} from "../../src/options";

describe.each([false, true])("React callback model enabled=%s", enabled => {
    let solver: Solver;
    const named = (name: string) => {
        const matches = [...solver.globalState.functionInfos.values()].filter(f =>
            f.name === name && f.moduleInfo.getPath().includes(`${path.sep}fixtures${path.sep}`));
        expect(matches.map(f => f.toString())).toHaveLength(1);
        return matches[0];
    };
    const edge = (from: string, to: string) =>
        solver.fragmentState.functionToFunction.get(named(from))?.has(named(to)) ?? false;

    beforeAll(async () => {
        resetOptions();
        options.basedir = path.resolve("tests/flow");
        options.reactCallbackModel = enabled;
        options.callgraphExternal = false;
        options.loglevel = logger.transports[0].level = "error";
        solver = new Solver();
        await analyzeFiles(["fixtures/react-model/index.ts"], solver);
        expect(solver.diagnostics.errors).toBe(0);
        expect(solver.diagnostics.timeout).toBe(false);
        expect(solver.diagnostics.aborted).toBe(false);
    }, 30000);
    afterAll(() => resetOptions());

    test.each([
        ["callAlias", "savedAlias"], ["callNamespace", "savedNamespace"],
        ["callDefault", "savedDefault"], ["callReexport", "savedReexport"],
    ])("%s -> %s", (from, to) => {
        expect(edge(from, to)).toBe(enabled);
    });
    test("does not execute a callback when passed to useCallback", () => {
        const callback = named("neverInvoked");
        for (const callees of solver.fragmentState.functionToFunction.values())
            expect(callees.has(callback)).toBe(false);
        expect(edge("useCustom", "savedAlias")).toBe(false);
    });
    test("keeps unrelated local/package/version semantics", () => {
        expect(edge("callLocal", "localIgnored")).toBe(false);
        expect(edge("callOther", "otherIgnored")).toBe(false);
        expect(edge("callUnsupported", "unsupportedIgnored")).toBe(false);
        expect(edge("callLocal", "localResult")).toBe(true);
        expect(edge("callOther", "otherResult")).toBe(true);
        expect(edge("callUnsupported", "unsupportedResult")).toBe(true);
    });
    test("does not invent cross-callback edges", () => {
        expect(edge("callAlias", "savedNamespace")).toBe(false);
        expect(edge("callNamespace", "savedAlias")).toBe(false);
    });
    test("retains actual React source analysis", () => {
        expect([...solver.globalState.moduleInfos.values()].some(m =>
            m.packageInfo.name === "react" && m.packageInfo.version === "18.3.1" &&
            m.relativePath.replaceAll("\\", "/") === "cjs/react.development.js")).toBe(true);
    });
    test("reports model scope and return transfers separately from calls", () => {
        expect(solver.diagnostics.libraryModels).toHaveLength(enabled ? 1 : 0);
        if (enabled) {
            const evidence = solver.diagnostics.libraryModels[0];
            expect(evidence.version).toBe("18.3.1");
            expect(evidence.relation).toBe("return-argument");
            expect(evidence.implementationAnalyzed).toBe(true);
            expect(evidence.calls).toHaveLength(5);
        }
    });
});
