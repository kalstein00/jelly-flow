import path from "node:path";
import {analyzeFiles} from "../../src/analysis/analyzer";
import {FunctionInfo} from "../../src/analysis/infos";
import Solver from "../../src/analysis/solver";
import logger from "../../src/misc/logger";
import {options, resetOptions} from "../../src/options";

// These source locations refer to the unchanged, versioned evaluation fixtures.
// Resolve each function uniquely so a missing function cannot pass a negative check.
function at(solver: Solver, file: string, line: number): FunctionInfo {
    const matches = [...solver.globalState.functionInfos.values()].filter(f =>
        !f.isDummyConstructor &&
        f.moduleInfo.getPath().replaceAll("\\", "/").endsWith(`/${file}`) && f.loc.start.line === line);
    expect(matches.map(f => f.toString())).toHaveLength(1);
    return matches[0];
}

async function analyze(entry: string): Promise<Solver> {
    resetOptions();
    options.basedir = path.resolve("tests/flow");
    options.mapKeys = true;
    options.loglevel = logger.transports[0].level = "error";
    const solver = new Solver();
    await analyzeFiles([entry], solver);
    expect(solver.diagnostics.errors).toBe(0);
    expect(solver.diagnostics.timeout).toBe(false);
    expect(solver.diagnostics.aborted).toBe(false);
    expect(solver.diagnostics.unprocessedTokensSize).toBe(0);
    return solver;
}

describe("tests/flow baseline", () => {
    let solver: Solver;
    beforeAll(async () => { solver = await analyze("fixtures/baseline/caller.ts"); });
    afterAll(() => resetOptions());

    test.each([
        ["alias", "caller.ts", 3, "leaf.ts", 1],
        ["re-export", "caller.ts", 4, "leaf.ts", 1],
        ["method A", "caller.ts", 5, "leaf.ts", 2],
        ["method B", "caller.ts", 5, "leaf.ts", 3],
        ["parameter callback", "caller.ts", 6, "leaf.ts", 1],
        ["returned callback", "caller.ts", 10, "caller.ts", 9],
        ["callback body", "caller.ts", 9, "leaf.ts", 1],
        ["Map callback", "caller.ts", 13, "leaf.ts", 1],
    ] as const)("%s", (_name, fromFile, fromLine, toFile, toLine) => {
        expect(solver.fragmentState.functionToFunction.get(at(solver, fromFile, fromLine)))
            .toContain(at(solver, toFile, toLine));
    });
});

describe("tests/flow Map negative controls", () => {
    let solver: Solver;
    let save: FunctionInfo, remove: FunctionInfo, saveOnly: FunctionInfo, removeOnly: FunctionInfo;
    beforeAll(async () => {
        solver = await analyze("fixtures/negative.ts");
        save = at(solver, "negative.ts", 1);
        remove = at(solver, "negative.ts", 2);
        saveOnly = at(solver, "negative.ts", 6);
        removeOnly = at(solver, "negative.ts", 7);
    });
    afterAll(() => resetOptions());

    test("saveOnly calls save", () => {
        expect(solver.fragmentState.functionToFunction.get(saveOnly)).toContain(save);
    });
    test("removeOnly calls remove", () => {
        expect(solver.fragmentState.functionToFunction.get(removeOnly)).toContain(remove);
    });
    test("neverCalled has no incoming edges", () => {
        const unrelated = at(solver, "negative.ts", 8);
        for (const callees of solver.fragmentState.functionToFunction.values())
            expect(callees).not.toContain(unrelated);
    });

    test("saveOnly must not call remove", () => {
        expect(solver.fragmentState.functionToFunction.get(saveOnly)).not.toContain(remove);
    });
    test("removeOnly must not call save", () => {
        expect(solver.fragmentState.functionToFunction.get(removeOnly)).not.toContain(save);
    });
});
