import {readFileSync, writeFileSync, renameSync, rmSync} from "fs";
import {randomUUID} from "crypto";
import path from "path";
import {CallGraph} from "../typings/callgraph";

export interface ReportInput {
    version: 1;
    snapshot: string;
    created: string;
    selection: "all" | string[];
    inventory: Array<{path: string, areas: string[]}>;
    runs: Array<{area: string, status: "completed" | "partial" | "failed", graph?: CallGraph,
        diagnostics: Record<string, unknown>}>;
}
export interface ReportFunction {id: string, file: string, name: string, location: string}
export interface ReportEdge {source: string, target: string, kind: "call" | "import", count: number,
    pairs: Array<[string, string]>, sites: string[]}
export interface ReportModel {
    snapshot: string; created: string; selection: ReportInput["selection"];
    files: Array<{path: string, areas: string[], folder: string, callers: number,
        status: "unanalyzed" | "analyzed", functions: ReportFunction[]}>;
    edges: ReportEdge[];
    runs: Array<Omit<ReportInput["runs"][number], "graph">>;
    limitations: string[];
}

function sourcePath(value: string): string {
    if (typeof value !== "string" || !value || value.includes("\0"))
        throw new Error("Invalid source path");
    const normalized = value.replaceAll("\\", "/");
    if (normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || normalized.split("/").includes(".."))
        throw new Error("Source paths must be relative to the snapshot");
    return normalized;
}

/** Public report seam. Inputs contain evidence, never executable HTML or source text. */
export function generateReport(input: ReportInput): {model: ReportModel, html: string} {
    if (input?.version !== 1 || typeof input.snapshot !== "string" || !input.snapshot ||
        !Array.isArray(input.inventory) || !Array.isArray(input.runs) || !input.runs.length)
        throw new Error("Invalid report envelope");
    const files = new Map<string, ReportModel["files"][number]>();
    for (const item of input.inventory) {
        const file = sourcePath(item.path);
        if (!Array.isArray(item.areas) || item.areas.some(a => typeof a !== "string"))
            throw new Error("Invalid areas");
        if (files.has(file)) throw new Error("Duplicate inventory path");
        files.set(file, {path: file, areas: [...item.areas], folder: path.posix.dirname(file),
            callers: 0, status: "unanalyzed", functions: []});
    }
    const functions = new Map<string, ReportFunction>(), edges = new Map<string, ReportEdge>();
    const limitations = new Set(["Possible calls are static possibilities, not execution.",
        "No edge does not prove dead code. JSX/event/IPC coverage is unavailable.",
        "Per-edge derivation attribution is unavailable. Size is distinct caller files; width is distinct function pairs."]);
    let validRuns = 0;
    for (const run of input.runs) {
        if (!["completed", "partial", "failed"].includes(run.status) || !run.area || !run.diagnostics)
            throw new Error("Invalid run status");
        if (run.status === "failed") continue;
        const graph = run.graph;
        if (!graph || !Array.isArray(graph.files) || !graph.functions || !graph.calls ||
            !Array.isArray(graph.fun2fun) || !Array.isArray(graph.call2fun))
            throw new Error("Invalid graph");
        validRuns++;
        const locations = (loc: string) => {
            const match = /^(\d+):(\d+):(\d+):(\d+):(\d+)$/.exec(loc);
            if (!match || !graph.files[Number(match[1])]) throw new Error("Invalid source location");
            const file = sourcePath(graph.files[Number(match[1])]);
            if (!files.has(file)) throw new Error("Graph file outside inventory: " + file);
            return {file, location: file + loc.slice(match[1].length)};
        };
        for (const file of graph.files) {
            const item = files.get(sourcePath(file));
            if (!item) throw new Error("Graph file outside inventory: " + file);
            item.status = "analyzed";
        }
        const ids = new Map<number, string>();
        for (const [index, loc] of Object.entries(graph.functions)) {
            const where = locations(loc);
            const meta = graph.functionMetadata?.[Number(index)];
            if (!meta) { limitations.add("Function/module classification unavailable for some entries."); continue; }
            if (meta.kind === "module") continue;
            if (meta.kind !== "function") throw new Error("Invalid function kind");
            const id = where.location;
            ids.set(Number(index), id);
            functions.set(id, {id, ...where, name: meta.name || "(anonymous) " + where.location});
        }
        for (const pair of graph.fun2fun) {
            if (!Array.isArray(pair) || pair.length !== 2 ||
                graph.functions[pair[0]] === undefined || graph.functions[pair[1]] === undefined)
                throw new Error("Invalid function edge");
            const a = ids.get(pair[0]), b = ids.get(pair[1]);
            if (!a || !b) continue;
            const source = functions.get(a)!.file, target = functions.get(b)!.file;
            const key = JSON.stringify([source, target]);
            let edge = edges.get(key);
            if (!edge) { edge = {source, target, kind: "call", count: 0, pairs: [], sites: []}; edges.set(key, edge); }
            if (!edge.pairs.some(p => p[0] === a && p[1] === b)) edge.pairs.push([a, b]);
        }
        for (const [site, target] of graph.call2fun) {
            if (!graph.calls[site] || !graph.functions[target]) throw new Error("Invalid call edge");
            const where = locations(graph.calls[site]), id = ids.get(target);
            if (!id) continue;
            const edge = edges.get(JSON.stringify([where.file, functions.get(id)!.file]));
            if (edge && !edge.sites.includes(where.location)) edge.sites.push(where.location);
        }
    }
    if (!validRuns) throw new Error("No valid analysis results");
    for (const fun of functions.values()) files.get(fun.file)!.functions.push(fun);
    for (const edge of edges.values()) {
        edge.count = edge.pairs.length;
        if (edge.source !== edge.target) files.get(edge.target)!.callers++;
    }
    const model: ReportModel = {snapshot: input.snapshot, created: input.created, selection: input.selection,
        files: [...files.values()], edges: [...edges.values()], limitations: [...limitations],
        runs: input.runs.map(({area, status, diagnostics}) => ({area, status, diagnostics}))};
    const data = JSON.stringify(model).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
    const template = readFileSync(path.resolve(__dirname, "../../resources/offline-report.html"), "utf8");
    return {model, html: template.replace("/*REPORT_DATA*/null", () => data)};
}

export function writeReport(input: ReportInput, output: string): ReportModel {
    const result = generateReport(input);
    const temporary = output + "." + randomUUID() + ".tmp";
    try {
        writeFileSync(temporary, result.html, {flag: "wx"});
        renameSync(temporary, output);
    } finally {
        rmSync(temporary, {force: true});
    }
    return result.model;
}
