import {closeSync, openSync, writeSync} from "fs";
import type Solver from "./solver";
import {options} from "../options";

/** Opt-in, crash-surviving NDJSON. Never enumerate solver collections or force GC. */
export class MemoryTrace {
    private started = false;
    private fd?: number;
    private last = 0;
    private readonly start = performance.now();

    checkpoint(solver: Solver, phase: string, module?: string, force = true) {
        if (!options.memoryTrace)
            return;
        const now = performance.now();
        if (!force && now - this.last < 1000)
            return;
        this.last = now;
        if (this.fd === undefined)
            this.fd = openSync(options.memoryTrace, this.started ? "a" : "wx");
        this.started = true;
        const f = solver.fragmentState, a = solver.globalState;
        writeSync(this.fd, JSON.stringify({
            elapsedMs: Math.round(now - this.start), phase, module,
            ...process.memoryUsage(), modules: solver.diagnostics.modules,
            functions: a.functionInfos.size, vars: f.vars.size, tokens: f.numberOfTokens,
            uniqueTokens: a.canonicalTokens.size, subsetEdges: f.numberOfSubsetEdges,
            listenerKeys: solver.listeners.size, pendingTokenVars: solver.unprocessedTokens.size,
            listenerDedupEntries: f.listenersProcessed.size,
            listenerQueue: f.postponedListenerCalls.length,
            boundedListenerQueue: f.postponedListenerCalls2.length,
            activeBoundedListenerQueue: solver.activeListenerCalls?.length ?? 0,
            listenersProcessed: solver.postponedListenersProcessed,
            callEdges: f.numberOfCallToFunctionEdges, propertyReads: f.propertyReads.length,
            defUseModules: a.defUse.size,
        }) + "\n");
    }

    close() {
        if (this.fd !== undefined) {
            closeSync(this.fd);
            this.fd = undefined;
        }
    }
}
