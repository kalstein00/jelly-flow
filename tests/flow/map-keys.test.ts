import path from "node:path";
import {analyzeFiles} from "../../src/analysis/analyzer";
import Solver from "../../src/analysis/solver";
import logger from "../../src/misc/logger";
import {options, resetOptions} from "../../src/options";

describe.each([true, false])("Map keys with cycle elimination=%s", cycleElimination => {
    let solver: Solver;
    const named = (name: string) => {
        const matches = [...solver.globalState.functionInfos.values()].filter(f => f.name === name);
        expect(matches.map(f => f.toString())).toHaveLength(1);
        return matches[0];
    };
    const edge = (from: string, to: string) =>
        solver.fragmentState.functionToFunction.get(named(from))?.has(named(to)) ?? false;
    beforeAll(async () => {
        resetOptions();
        options.basedir = path.resolve("tests/flow");
        options.mapKeys = true;
        options.cycleElimination = cycleElimination;
        options.spread = true;
        options.loglevel = logger.transports[0].level = "error";
        solver = new Solver();
        await analyzeFiles(["fixtures/map-keys.ts"], solver);
        expect(solver.diagnostics.errors).toBe(0);
    });
    afterAll(() => resetOptions());
    test.each([
        ["overwrite", "first"], ["overwrite", "second"], ["overwrite", "unknown"],
        ["unknownRead", "first"], ["unknownRead", "third"], ["unknownRead", "unknown"],
        ["knownAfterUnknown", "third"], ["knownAfterUnknown", "unknown"],
        ["viaAlias", "first"], ["viaAlias", "second"],
        ["afterDelete", "first"], ["afterClear", "third"],
        ["values", "first"], ["values", "third"], ["entries", "second"],
        ["constructorRead", "first"], ["constructorRead", "second"],
        ["copiedRead", "first"], ["copiedRead", "third"],
        ["chainedRead", "first"], ["stringKey", "first"], ["numberKey", "second"],
        ["objectRead", "first"], ["objectRead", "second"], ["objectRead", "third"],
        ["reassignedRead", "second"], ["spreadRead", "first"],
        ["booleanKey", "first"], ["nullKey", "second"], ["zeroKey", "third"],
        ["keys", "first"], ["defaultIterator", "second"],
    ])("preserves %s -> %s", (from, to) => expect(edge(from, to)).toBe(true));
    test.each([
        ["overwrite", "third"], ["knownAfterUnknown", "first"],
        ["chainedRead", "second"], ["stringKey", "second"], ["numberKey", "first"],
        ["booleanKey", "second"], ["nullKey", "third"], ["zeroKey", "first"],
    ])("rejects %s -> %s", (from, to) => expect(edge(from, to)).toBe(false));
    test("forEach callback still sees every value", () => {
        const each = named("each");
        const callbacks = [...solver.fragmentState.functionToFunction.get(each)!];
        expect(callbacks).toHaveLength(1);
        for (const name of ["first", "second", "third", "unknown"])
            expect(solver.fragmentState.functionToFunction.get(callbacks[0])?.has(named(name))).toBe(true);
    });
});
