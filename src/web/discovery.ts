import {existsSync, readFileSync, realpathSync, statSync, readdirSync, lstatSync} from "fs";
import path from "path";
import type {ProjectConfig} from "../report/project";

export interface Proposal {root: string; areas: ProjectConfig["areas"]; evidence: string[]; warnings: string[]}

/** Static suggestions only: never execute the target's build configuration. */
export function suggestProject(folder: string): Proposal {
    if (typeof folder !== "string" || !path.isAbsolute(folder)) throw new Error("Choose an absolute project folder.");
    const root = realpathSync(folder);
    if (!statSync(root).isDirectory()) throw new Error("Project folder must be a directory.");
    const proposal: Proposal = {root, areas: [], evidence: [], warnings: ["Suggestions are not a completeness guarantee. Review entries and source roots before saving."]};
    const contained = (absolute: string) => {
        if (!existsSync(absolute)) return false;
        const inside = path.relative(root, realpathSync(absolute));
        return inside !== ".." && !inside.startsWith(".." + path.sep) && !path.isAbsolute(inside);
    };
    const file = (relative: string) => {
        const resolved = path.resolve(root, relative), inside = path.relative(root, resolved);
        return inside !== ".." && !inside.startsWith(".." + path.sep) && !path.isAbsolute(inside) && contained(resolved) && statSync(resolved).isFile();
    };
    const normalize = (p: string) => p.replaceAll("\\", "/");
    const read = (p: string) => readFileSync(path.join(root, p), "utf8");
    const packageAt = (prefix: string): Record<string, unknown> => {
        const name = path.join(prefix, "package.json");
        if (!file(name)) return {};
        try {return JSON.parse(read(name));} catch {proposal.warnings.push("Invalid package.json: " + name); return {};}
    };
    const htmlEntries = (html: string) => {
        if (!file(html)) return [];
        const entries: string[] = [];
        for (const match of read(html).matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
            if (/^(?:https?:|data:|\/\/)/i.test(match[1])) continue;
            const candidate = normalize(path.join(path.dirname(html), match[1].replace(/^\/+/, "").split("?")[0]));
            if (file(candidate)) entries.push(candidate);
            else proposal.warnings.push("Unresolved HTML entry: " + candidate);
        }
        return entries;
    };
    const prefixes = [""];
    const workspaceValue = packageAt("").workspaces;
    const workspaces = Array.isArray(workspaceValue) ? workspaceValue : (workspaceValue as {packages?: unknown})?.packages;
    if (Array.isArray(workspaces)) for (const pattern of workspaces) {
        if (typeof pattern !== "string") continue;
        if (pattern.endsWith("/*") && !pattern.slice(0, -2).includes("*")) {
            const base = pattern.slice(0, -2);
            const absolute = path.resolve(root, base), relative = path.relative(root, absolute);
            if (relative.startsWith("..") || path.isAbsolute(relative) || !contained(absolute)) continue;
            for (const name of readdirSync(absolute)) if (file(path.join(base, name, "package.json"))) prefixes.push(normalize(path.join(base, name)));
        } else if (!pattern.includes("*") && file(path.join(pattern, "package.json"))) prefixes.push(normalize(pattern));
        else proposal.warnings.push("Workspace pattern needs manual review: " + pattern);
    }
    const add = (prefix: string, name: string, entries: string[], roots: string[], evidence: string) => {
        if (!entries.length) {proposal.warnings.push("No confirmed entry for " + [prefix, name].filter(Boolean).join("/"));return;}
        proposal.areas.push({name: [prefix, name].filter(Boolean).join("/"), entries: [...new Set(entries.map(normalize))], roots: roots.map(normalize)});
        proposal.evidence.push(evidence + ": " + entries.join(", "));
    };
    for (const prefix of [...new Set(prefixes)]) {
        const local = (p: string) => normalize(path.join(prefix, p));
        const electronConfig = ["electron.vite.config.ts", "electron.vite.config.js", "electron.vite.config.mjs"].map(local).find(file);
        if (electronConfig) {
            const config = read(electronConfig);
            for (const area of ["main", "preload", "renderer"]) {
                if (!new RegExp("\\b" + area + "\\s*:").test(config)) continue;
                const entries = area === "renderer" ? htmlEntries(local("src/renderer/index.html")) :
                    ["ts", "js", "mts", "cts"].map(ext => local(`src/${area}/index.${ext}`)).filter(file);
                add(prefix, area, entries, [local(`src/${area}`)], electronConfig + " + existing conventional source");
            }
            if (/\binput\s*:/.test(config)) proposal.warnings.push(electronConfig + " contains custom build input; verify or replace conventional entries manually.");
        } else {
            const pkg = packageAt(prefix);
            let source = typeof pkg.source === "string" && file(local(pkg.source)) ? local(pkg.source) : undefined;
            let entries = source ? [source] : htmlEntries(local("index.html"));
            let evidence = source ? local("package.json") + " source" : local("index.html") + " script source";
            if (!entries.length) {
                const candidates = ["src/main.ts", "src/main.tsx", "src/index.ts", "src/index.tsx", "main.ts", "index.ts", "src/main.js", "src/index.js"].map(local).filter(file);
                entries = prefix === "" && prefixes.length > 1 ? [] : candidates.slice(0, 1);
                evidence = "Existing conventional entry (confirm runtime entry)";
                if (!entries.length && candidates.length) proposal.warnings.push("Workspace-root source is unassigned; add it manually if it is a runtime area: " + candidates.join(", "));
                if (candidates.length > 1) proposal.warnings.push("Other possible entries need review: " + candidates.slice(1).join(", "));
            }
            if (entries.length) {
                const roots = [...new Set(entries.map(entry => entry.startsWith(local("src") + "/") ? local("src") : prefix || "."))];
                add(prefix, "app", entries, roots, evidence);
            }
        }
        const scanRoot = local("src");
        let scanned = 0;
        const workers = new Set<string>();
        const scan = (directory: string) => {
            if (!contained(path.join(root, directory)) || !statSync(path.join(root, directory)).isDirectory()) return;
            for (const name of readdirSync(path.join(root, directory))) {
                if (scanned >= 20000) return;
                if (/^(node_modules|dist|build|out|vendor|tests?|__tests__|fixtures)$/.test(name) || /\.(test|spec)\./.test(name)) continue;
                const relative = normalize(path.join(directory, name)), absolute = path.join(root, relative);
                if (lstatSync(absolute).isSymbolicLink()) {proposal.warnings.push("Skipped source symlink: " + relative); continue;}
                if (statSync(absolute).isDirectory()) {scan(relative); continue;}
                if (!/\.[cm]?[jt]sx?$/.test(name)) continue;
                scanned++;
                const text = read(relative);
                const candidates = [...text.matchAll(/["'](\.[^"']+)\?(?:modulePath|worker)(?:[^"']*)["']/g)].map(m => m[1]);
                for (const match of text.matchAll(/new\s+Worker\s*\(\s*new\s+URL\s*\(\s*["'](\.[^"']+)["']/g)) candidates.push(match[1]);
                for (const candidate of candidates) {
                    const base = normalize(path.join(path.dirname(relative), candidate));
                    const target = [base, base + ".ts", base + ".tsx", base + ".js"].find(file);
                    if (target) workers.add(target);
                    else proposal.warnings.push("Unresolved worker source: " + base);
                }
                if (/new\s+Worker\s*\(/.test(text)) proposal.warnings.push("Embedded or dynamic worker code needs review: " + relative + ". String bodies are not analyzed.");
            }
        };
        scan(scanRoot);
        if (scanned >= 20000) proposal.warnings.push("Worker discovery stopped at 20,000 source files; review remaining sources.");
        for (const entry of workers) add(prefix, "worker:" + path.relative(prefix || ".", entry).replaceAll("\\", "/"), [entry], [entry], "Explicit worker source reference");
    }
    if (!proposal.areas.length) proposal.warnings.push("No supported entry was found. Add analysis areas manually.");
    return proposal;
}
