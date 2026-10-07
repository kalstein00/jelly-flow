import {readFileSync} from "fs";
import {analyzeFiles} from "../analysis/analyzer";
import Solver from "../analysis/solver";
import {options, resetOptions} from "../options";
import {AnalysisStateReporter} from "../output/analysisstatereporter";
import logger from "../misc/logger";

async function main() {
    const input = JSON.parse(readFileSync(0, "utf8"));
    resetOptions();
    options.basedir = input.root;
    options.appOnly = input.root;
    options.mapKeys = true;
    options.timeout = input.timeout;
    options.loglevel = logger.transports[0].level = "error";
    const solver = new Solver();
    await analyzeFiles(input.entries, solver);
    const d = solver.diagnostics;
    const status = d.errors || d.timeout || d.aborted || d.memoryLimitReached ||
        d.unprocessedTokensSize || d.waveLimitReached || d.indirectionsLimitReached ||
        d.finalizationStatus !== "complete" ? "partial" : "completed";
    const graph = new AnalysisStateReporter(solver.fragmentState).callGraphToJSON(input.entries);
    const diagnostics = JSON.parse(JSON.stringify(d, (_key, value) => typeof value === "bigint" ? value.toString() : value));
    process.stdout.write(JSON.stringify({status, graph, diagnostics}));
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
