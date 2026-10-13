import {mkdirSync, readFileSync, writeFileSync, statSync, realpathSync, existsSync, renameSync} from "fs";
import path from "path";
import {randomUUID} from "crypto";
import {fork, ChildProcess, execFile} from "child_process";
import type {ProjectConfig} from "../report/project";
import type {ReportModel} from "../report/report";
import {readArtifacts} from "./artifacts";

export interface AnalysisResult {id: string; status: "completed" | "partial"; created: string; snapshot: string}
export interface Project {
    id: string;
    name: string;
    config: ProjectConfig;
    results: AnalysisResult[];
    current?: string;
    displayed?: string;
    previous?: string;
    attempt?: {id: string; status: "running" | "completed" | "partial" | "failed" | "reused"; message?: string};
}

export function validateConfig(value: ProjectConfig, dataDir: string): ProjectConfig {
    if (!value || typeof value.root !== "string" || !path.isAbsolute(value.root)) throw new Error("Choose an absolute project folder.");
    const root = realpathSync(value.root);
    if (!statSync(root).isDirectory()) throw new Error("Project folder must be a directory.");
    const dataRelative = path.relative(root, realpathSync(dataDir));
    if (dataRelative !== ".." && !dataRelative.startsWith(".." + path.sep) && !path.isAbsolute(dataRelative))
        throw new Error("Tool storage must be outside the target project.");
    if (!Array.isArray(value.areas) || !value.areas.length) throw new Error("Add at least one analysis area.");
    const names = new Set<string>();
    for (const area of value.areas) {
        if (!area || typeof area.name !== "string" || !area.name.trim() || names.has(area.name)) throw new Error("Area names must be nonempty and unique.");
        names.add(area.name);
        for (const field of ["entries", "roots"] as const) {
            if (!Array.isArray(area[field]) || !area[field].length) throw new Error("Each area needs entries and roots.");
            for (const relative of area[field]) {
                if (typeof relative !== "string" || path.isAbsolute(relative)) throw new Error("Entries and roots must be project-relative paths.");
                const absolute = realpathSync(path.resolve(root, relative));
                const inside = path.relative(root, absolute);
                if (inside === ".." || inside.startsWith(".." + path.sep) || path.isAbsolute(inside)) throw new Error("Analysis paths must remain inside the project.");
                if (field === "entries" && !statSync(absolute).isFile()) throw new Error("An entry must be a source file.");
            }
        }
    }
    for (const [key, min, max] of [["timeoutSeconds", 1, 900], ["heapMB", 256, 16384]] as const)
        if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key]! < min || value[key]! > max))
            throw new Error(`${key} must be between ${min} and ${max}.`);
    return {root, areas: value.areas, selection: "all", timeoutSeconds: value.timeoutSeconds ?? 90, heapMB: value.heapMB ?? 4096};
}

/** Project and analysis lifecycle exposed by the local web API. Analysis stays off the HTTP event loop. */
export class Projects {
    private projects = new Map<string, Project>();
    private children = new Set<ChildProcess>();
    constructor(readonly dataDir: string) {
        mkdirSync(dataDir, {recursive: true});
        const file = path.join(dataDir, "projects.json");
        if (existsSync(file)) {
            const saved = JSON.parse(readFileSync(file, "utf8")) as Project[];
            if (!Array.isArray(saved)) throw new Error("Project storage is invalid.");
            for (const project of saved) {
                if (!/^[\w-]+$/.test(project.id) || !Array.isArray(project.results) ||
                    project.results.some(result => !/^[\w-]+$/.test(result.id))) throw new Error("Project storage is invalid.");
                if (project.attempt?.status === "running") project.attempt = {...project.attempt, status: "failed", message: "Analysis interrupted when the tool stopped."};
                this.projects.set(project.id, project);
            }
        }
    }
    private persist(): void {
        const file = path.join(this.dataDir, "projects.json"), temporary = file + ".tmp";
        writeFileSync(temporary, JSON.stringify(this.list(), null, 2));
        renameSync(temporary, file);
    }
    list(): Project[] { return [...this.projects.values()]; }
    get(id: string): Project { const project = this.projects.get(id); if (!project) throw new Error("Project not found."); return project; }
    save(value: {id?: string; config: ProjectConfig}): Project {
        const config = validateConfig(value.config, this.dataDir);
        const project = value.id ? this.get(value.id) : {id: randomUUID(), name: path.basename(config.root), config, results: []};
        if (project.attempt?.status === "running") throw new Error("Wait for the current analysis before editing this project.");
        project.config = config;
        project.name = path.basename(config.root);
        this.projects.set(project.id, project);
        this.persist();
        return project;
    }
    resultDirectory(id: string, resultId: string): string {
        const project = this.get(id);
        if (!project.results.some(result => result.id === resultId)) throw new Error("Result not found.");
        return path.join(this.dataDir, id, resultId);
    }
    model(id: string, resultId: string): ReportModel {
        return this.artifacts(id, resultId).model;
    }
    html(id: string, resultId: string): string {return this.artifacts(id, resultId).html;}
    private artifacts(id: string, resultId: string) {
        const bundle = readArtifacts(this.resultDirectory(id, resultId));
        const result = this.get(id).results.find(item => item.id === resultId)!;
        if (bundle.input.snapshot !== result.snapshot || bundle.status !== result.status)
            throw new Error("Stored result does not match its registered snapshot.");
        return bundle;
    }
    display(id: string, resultId: string): Project {
        this.artifacts(id, resultId);
        const project = this.get(id), previous = project.displayed ?? project.current;
        if (previous !== resultId) project.previous = previous;
        project.displayed = resultId;
        this.persist();
        return project;
    }
    analyze(id: string): Project {
        const project = this.get(id);
        if (project.attempt?.status === "running") throw new Error("An analysis is already running for this project.");
        const runId = randomUUID(), directory = path.join(this.dataDir, id, runId);
        mkdirSync(directory, {recursive: true});
        const configFile = path.join(directory, "config.json");
        writeFileSync(configFile, JSON.stringify(project.config));
        project.attempt = {id: runId, status: "running"};
        this.persist();
        const previous = project.current ? this.resultDirectory(id, project.current) : "";
        const child = fork(path.resolve(__dirname, "../../lib/web/analyze.js"), [configFile, directory, previous],
            {silent: true, detached: process.platform !== "win32"});
        this.children.add(child);
        let error = "";
        child.stderr?.on("data", data => { error = (error + data).slice(-8000); });
        const finish = (message?: {result?: AnalysisResult; error?: string; reused?: string; message?: string}) => {
            if (project.attempt?.id !== runId || project.attempt.status !== "running") return;
            if (message?.reused && message.reused === project.current) {
                project.attempt = {id: runId, status: "reused"};
                project.displayed = project.current;
                project.previous = undefined;
            }
            else if (message?.result) {
                const result = {...message.result, id: runId};
                project.results.push(result);
                project.attempt = {id: runId, status: result.status, message: message.message};
                if (result.status === "completed") {
                    project.current = project.displayed = runId;
                    project.previous = undefined;
                }
            } else project.attempt = {id: runId, status: "failed", message: message?.error || error || "Analysis process stopped."};
            this.persist();
        };
        child.on("message", message => finish(message as {result?: AnalysisResult; error?: string}));
        child.on("error", e => finish({error: e.message}));
        child.on("exit", () => {this.children.delete(child); finish();});
        return project;
    }
    async close(): Promise<void> {
        await Promise.all([...this.children].map(child => new Promise<void>(resolve => {
            if (!child.pid || child.exitCode !== null) {resolve(); return;}
            child.once("exit", () => resolve());
            if (process.platform === "win32") execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], {windowsHide: true}, () => resolve());
            else {try {process.kill(-child.pid, "SIGTERM");} catch {child.kill("SIGTERM");} resolve();}
        })));
    }
}
