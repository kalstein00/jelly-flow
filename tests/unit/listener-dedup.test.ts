import Solver from "../../src/analysis/solver";
import {NativeObjectToken, Token} from "../../src/analysis/tokens";
import {TokenListener} from "../../src/analysis/listeners";
import {options, resetOptions} from "../../src/options";

afterEach(() => resetOptions());
test.each([false, true])("token listeners remain deduplicated across variables and waves (bounded=%s)", async bounded => {
    resetOptions();
    if (bounded) options.maxIndirections = 10;
    const solver = new Solver(), a = solver.globalState;
    const holder = a.canonicalizeToken(new NativeObjectToken("holder"));
    const one = a.canonicalizeToken(new NativeObjectToken("one"));
    const two = a.canonicalizeToken(new NativeObjectToken("two"));
    const x = solver.varProducer.objPropVar(holder, "x"), y = solver.varProducer.objPropVar(holder, "y");
    const seen: Token[] = [], listener = (t: Token) => { seen.push(t); };
    solver.addForAllTokensConstraint(x, TokenListener.CALL_FUNCTION, {s: "test"}, listener);
    solver.addTokenConstraint(one, x);
    await solver.propagate("Testing");
    expect(seen).toEqual([one]);
    solver.addForAllTokensConstraint(y, TokenListener.CALL_FUNCTION, {s: "test"}, listener);
    solver.addTokenConstraint(one, y);
    solver.addTokenConstraint(two, x);
    solver.addTokenConstraint(two, y);
    await solver.propagate("Testing");
    expect(seen).toEqual([one, two]);
});
