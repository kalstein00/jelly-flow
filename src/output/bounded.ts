import Solver from "../analysis/solver";
import {MemoryBudgetException} from "../analysis/budget";
import {AnalysisStateReporter} from "./analysisstatereporter";
import {options} from "../options";
import logger from "../misc/logger";

/** Persist diagnostics before attempting potentially costly graph serialization. */
export function saveAnalysisOutputs(solver: Solver, files: Array<string>) {
    const out = new AnalysisStateReporter(solver.fragmentState), d = solver.diagnostics;
    d.graphOutputStatus = options.callgraphJson ? "pending" : "not-requested";
    if (options.diagnosticsJson)
        out.saveDiagnostics(d, options.diagnosticsJson);
    const start = performance.now();
    const check = () => {
        // A separate, small output allowance lets a budget-stopped analysis emit a valid partial graph.
        solver.memoryBudget.check("serialization", true, 256);
        if (options.maxHeapMb !== undefined && performance.now() - start >= 10000)
            throw new MemoryBudgetException("serialization-time", 0);
    };
    try {
        solver.memoryTrace.checkpoint(solver, "serialization:start");
        if (options.callgraphJson) {
            out.saveCallGraph(options.callgraphJson, files, check);
            d.graphOutputStatus = "complete";
        }
        solver.memoryTrace.checkpoint(solver, "serialization:end");
    } catch (ex) {
        if (!(ex instanceof MemoryBudgetException)) throw ex;
        d.graphOutputStatus = "skipped-budget";
        d.terminationPhase = ex.phase;
        if (ex.phase === "serialization-time") d.timeout = true;
        else d.memoryLimitReached = true;
        logger.warn("Graph output budget reached; diagnostics preserved, graph not replaced");
    } finally {
        solver.memoryTrace.close();
        if (options.diagnosticsJson)
            out.saveDiagnostics(d, options.diagnosticsJson);
    }
}
