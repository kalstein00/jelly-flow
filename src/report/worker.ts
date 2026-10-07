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
    options.excludeEntries = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/tests/**", "**/test/**", "**/fixtures/**"];
    options.loglevel = logger.transports[0].level = "error";
    logger.silent = true; // stdout is the worker protocol; diagnostics are returned as structured data.
    const solver = new Solver();
    await analyzeFiles(input.entries, solver);
    const d = solver.diagnostics;
    const status = d.errors || d.timeout || d.aborted || d.memoryLimitReached ||
        d.unprocessedTokensSize || d.waveLimitReached || d.indirectionsLimitReached ||
        d.finalizationStatus !== "complete" ? "partial" : "completed";
    const graph = new AnalysisStateReporter(solver.fragmentState).callGraphToJSON(input.entries);
    const diagnostics = JSON.parse(JSON.stringify(d, (_key, value) => typeof value === "bigint" ? value.toString() : value));
    diagnostics.errorMessages = [...solver.fragmentState.errors].flatMap(([node, messages]) =>
        [...(typeof messages === "string" ? [messages] : messages)].map(message => ({
            message, location: node?.loc ? {file: node.loc.filename, line: node.loc.start.line, column: node.loc.start.column + 1} : undefined
        })));
    diagnostics.parseErrorFiles = solver.globalState.filesWithParseErrors;
    process.stdout.write(JSON.stringify({status, graph, diagnostics}));
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
