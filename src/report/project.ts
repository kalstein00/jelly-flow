import {readdirSync, readFileSync, lstatSync, realpathSync} from "fs";
import path from "path";
import {createHash} from "crypto";
import {spawnSync} from "child_process";
import {generateReport, ReportInput} from "./report";
import {collectImports} from "./imports";

export interface ProjectConfig {
    root: string;
    areas: Array<{name: string, entries: string[], roots: string[]}>;
    selection?: "all" | string[];
    timeoutSeconds?: number;
    heapMB?: number;
}
const excluded = /(^|\/)(node_modules|\.git|dist|lib|out|build|coverage|__tests__|tests?|fixtures)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/i;
export function projectPath(root: string, relative: string): string {
    const resolved = path.resolve(root, relative);
    const rel = path.relative(root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Path outside project: " + relative);
    const real = realpathSync(resolved), realRoot = realpathSync(root);
    const realRel = path.relative(realRoot, real);
    if (realRel.startsWith("..") || path.isAbsolute(realRel)) throw new Error("Symlink outside project: " + relative);
    return resolved;
}
export function projectInventory(config: ProjectConfig): ReportInput["inventory"] {
    const files = new Map<string, Set<string>>();
    const visit = (relative: string, area: string) => {
        const normalized = relative.replaceAll("\\", "/");
        if (excluded.test(normalized)) return;
        const absolute = projectPath(config.root, relative);
        if (lstatSync(absolute).isSymbolicLink()) return;
        if (lstatSync(absolute).isDirectory()) {
            for (const entry of readdirSync(absolute).sort()) visit(path.join(relative, entry), area);
        } else if (/\.[cm]?[jt]sx?$/.test(relative)) {
            if (!files.has(normalized)) files.set(normalized, new Set());
            files.get(normalized)!.add(area);
        }
    };
    for (const area of config.areas) for (const root of area.roots) visit(root, area.name);
    return [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, areas]) => ({path: file, areas: [...areas]}));
}
export async function buildProjectReport(config: ProjectConfig) {
    if (!config.root || !Array.isArray(config.areas) || !config.areas.length ||
        new Set(config.areas.map(a => a.name)).size !== config.areas.length)
        throw new Error("Invalid project configuration");
    config = {...config, root: path.resolve(config.root)};
    const inventory = projectInventory(config);
    const hash = createHash("sha256").update(JSON.stringify(config));
    for (const file of inventory) hash.update(file.path).update(readFileSync(projectPath(config.root, file.path)));
    const input: ReportInput = {version: 1, snapshot: hash.digest("hex"), created: new Date().toISOString(),
        selection: config.selection ?? "all", inventory, runs: []};
    for (const area of config.areas) {
        if (!area.name || !Array.isArray(area.entries) || !area.entries.length) throw new Error("Invalid area");
        for (const entry of area.entries) projectPath(config.root, entry);
        const worker = path.resolve(__dirname, "../../lib/report/worker.js");
        const result = spawnSync(process.execPath, ["--max-old-space-size=" + (config.heapMB ?? 4096), worker],
            {input: JSON.stringify({root: config.root, entries: area.entries, timeout: config.timeoutSeconds ?? 90}),
                encoding: "utf8", timeout: ((config.timeoutSeconds ?? 90) + 30) * 1000, maxBuffer: 128 * 1024 * 1024,
                windowsHide: true});
        if (result.status !== 0 || result.error) {
            input.runs.push({area: area.name, status: "failed", diagnostics: {
                exit: result.status, error: result.error?.message || result.stderr.slice(-4000)}});
            continue;
        }
        const run = JSON.parse(result.stdout) as ReportInput["runs"][number];
        input.runs.push({...run, area: area.name});
        // Analyzer-reached owned files may be outside the configured initial inventory roots.
        for (const file of run.graph?.files ?? []) {
            const normalized = file.replaceAll("\\", "/");
            projectPath(config.root, normalized);
            if (!inventory.some(item => item.path === normalized))
                inventory.push({path: normalized, areas: [area.name]});
        }
    }
    input.imports = collectImports(config.root, inventory);
    return {...generateReport(input), input};
}
