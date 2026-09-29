import fs from "node:fs";
import path from "node:path";
import {AnalysisEvidence, Location, Relation} from "../../docs/contracts/analysis-evidence-v1";

export type DartRun = {
    head: string, entry: string, base: string, dependencies: string, lockSha256: string,
    cliSha256: string, node: string, args: Array<string>, code: number | null, killed: boolean,
};
export type DartSummary = {
    status: "completed" | "partial" | "failed", heapOutOfMemory?: boolean,
    graphSha256?: string, selectionError?: string, outOfScopeFiles?: Array<string>,
    errors?: number, warnings?: number, timeout?: boolean, aborted?: boolean, unprocessedTokens?: number,
    closeCall?: {location: Location, targets: Array<Location>},
    libraryModels?: Array<{model: string, version: string, argument: number, calls: Array<string>}>,
    memoryLimitReached?: boolean, terminationPhase?: string, finalizationStatus?: string,
    statisticsStatus?: string, graphOutputStatus?: string, waveLimitReached?: number, indirectionsLimitReached?: number,
};

/** Evaluation-only adapter: never labels selected relations as a complete graph. */
export function buildEvidence(run: DartRun, summary: DartSummary, reference: string): AnalysisEvidence {
    const base = {
        schemaVersion: "jelly-flow-evidence/1" as const,
        coverage: "bounded" as const,
        selection: "DART closeViewInstance call and React return transfers" as const,
        source: {head: run.head, entry: run.entry, basedir: run.base,
            dependencyRoot: run.dependencies, lockSha256: run.lockSha256},
        analyzer: {reference, cliSha256: run.cliSha256, node: run.node, options: run.args.slice(2)},
        budget: {heapMB: 4096 as const, analysisSeconds: 90 as const, deadlineSeconds: 120 as const},
        registrationCoverage: "unavailable" as const,
        limitations: ["Selected relations only; graph completeness is unproven.",
            "May-call edges do not prove execution and have no per-edge derivation attribution.",
            "JSX registration, event execution and Electron IPC extraction are unavailable.",
            "React model supports only the public 18.3.1 entry; unsupported API behavior remains unanalyzed by that model."],
    };
    if (summary.status === "failed")
        return {...base, termination: "failed", relations: null, graphSha256: null, diagnostics: null,
            failure: {code: run.code, killed: run.killed, heapOutOfMemory: summary.heapOutOfMemory === true}};
    if (run.code !== 0 || run.killed)
        throw new Error("Termination contradicts process exit status");
    if (!["completed", "partial"].includes(summary.status) || !summary.graphSha256 ||
        (summary.graphOutputStatus !== undefined && summary.graphOutputStatus !== "complete") ||
        summary.selectionError || !summary.closeCall || !Array.isArray(summary.outOfScopeFiles) ||
        summary.outOfScopeFiles.length !== 0)
        throw new Error("Cannot export invalid or out-of-scope selected graph evidence");
    const {errors, warnings, timeout, aborted, unprocessedTokens} = summary;
    if (typeof errors !== "number" || typeof warnings !== "number" || typeof timeout !== "boolean" ||
        typeof aborted !== "boolean" || typeof unprocessedTokens !== "number")
        throw new Error("Cannot replace missing diagnostics with zeros");
    if (summary.status === "completed" && (errors !== 0 || timeout || aborted || unprocessedTokens !== 0 ||
        summary.memoryLimitReached || (summary.waveLimitReached ?? 0) > 0 || (summary.indirectionsLimitReached ?? 0) > 0 ||
        (summary.finalizationStatus !== undefined && summary.finalizationStatus !== "complete") ||
        (summary.statisticsStatus !== undefined && summary.statisticsStatus !== "complete")))
        throw new Error("Termination contradicts analyzer diagnostics");
    const relations: Array<Relation> = summary.closeCall.targets.map(target => ({
        kind: "may-call", callsite: summary.closeCall!.location, target, attribution: "unclassified",
    }));
    if (relations.length === 0)
        relations.push({kind: "unresolved", callsite: summary.closeCall.location, reason: "no-static-target"});
    for (const model of summary.libraryModels ?? [])
        for (const call of model.calls) {
            // Greedy file group preserves Windows drive letters.
            const match = /^(.*):(\d+):(\d+)$/.exec(call);
            if (!match) throw new Error(`Invalid model application location: ${call}`);
            const paths = /^[A-Za-z]:[\\/]/.test(run.base) ? path.win32 : path;
            relations.push({kind: "return-transfer", model: model.model, version: model.version,
                callsite: {file: paths.relative(run.base, match[1]).replaceAll("\\", "/"),
                    line: Number(match[2]), column: Number(match[3])},
                argument: model.argument});
        }
    return {...base, termination: summary.status, graphSha256: summary.graphSha256, relations,
        diagnostics: {errors, warnings, timeout, aborted, unprocessedTokens,
            memoryLimitReached: summary.memoryLimitReached, terminationPhase: summary.terminationPhase,
            finalizationStatus: summary.finalizationStatus, statisticsStatus: summary.statisticsStatus}};
}

if (require.main === module) {
    const [directory, reference, output] = process.argv.slice(2);
    if (!directory || !reference || !output)
        throw new Error("Expected run directory, analyzer reference, fresh output JSON path");
    const run = JSON.parse(fs.readFileSync(path.join(directory, "run.json"), "utf8")) as DartRun;
    const summary = JSON.parse(fs.readFileSync(path.join(directory, "summary.json"), "utf8")) as DartSummary;
    fs.writeFileSync(output, JSON.stringify(buildEvidence(run, summary, reference), null, 2) + "\n", {flag: "wx"});
}
