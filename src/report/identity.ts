import {createHash} from "crypto";
import {existsSync, lstatSync, readdirSync, readFileSync, realpathSync} from "fs";
import path from "path";
import {execFileSync} from "child_process";
import type {ProjectConfig} from "./project";

export function digest(data: string | Buffer): string { return createHash("sha256").update(data).digest("hex"); }

/** Hash source/config and installed dependency bytes plus the actual analyzer build. */
export function projectIdentity(config: ProjectConfig): string {
    const hash = createHash("sha256").update(JSON.stringify(config)).update(process.version);
    const visited = new Set<string>();
    const walk = (root: string, relative: string, mode: "project" | "tool" | "dependencies") => {
        const absolute = path.resolve(root, relative);
        if (!existsSync(absolute)) { hash.update("missing:" + absolute); return; }
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink()) {
            if (mode !== "dependencies") throw new Error("Snapshot identity does not support source symlink: " + absolute);
            const target = realpathSync(absolute);
            hash.update("dependency-link:" + absolute + ":" + target);
            walk(target, "", mode);
            return;
        }
        const canonical = mode + ":" + (process.platform === "win32" ? absolute.toLowerCase() : absolute);
        if (visited.has(canonical)) {hash.update("alias:" + absolute + ":" + canonical);return;}
        visited.add(canonical);
        if (stat.isDirectory()) {
            const name = path.basename(absolute);
            if ([".git", ".jelly-flow"].includes(name)) return;
            const next = name === "node_modules" ? "dependencies" : mode;
            for (const entry of readdirSync(absolute).sort()) walk(root, path.join(relative, entry), next);
        } else if (mode === "tool" || /\.(?:[cm]?[jt]sx?|es|json|ya?ml|css|html)$/.test(absolute)) {
            hash.update(mode + ":" + relative.replaceAll("\\", "/")).update(readFileSync(absolute));
        } else {
            hash.update("path:" + relative.replaceAll("\\", "/"));
        }
    };
    walk(path.resolve(config.root), "", "project");
    for (let parent = path.dirname(path.resolve(config.root)); ; parent = path.dirname(parent)) {
        if (existsSync(path.join(parent, "node_modules"))) walk(parent, "node_modules", "dependencies");
        for (const name of ["package.json", "tsconfig.json"])
            if (existsSync(path.join(parent, name))) walk(parent, name, "project");
        if (parent === path.dirname(parent)) break;
    }
    hash.update(process.env.NODE_PATH ?? "");
    for (const dependencyRoot of (process.env.NODE_PATH ?? "").split(path.delimiter).filter(Boolean))
        walk(dependencyRoot, "", "dependencies");
    const toolRoot = path.resolve(__dirname, "../..");
    for (const target of ["lib", "resources", "package-lock.json", "node_modules"]) walk(toolRoot, target, "tool");
    try { hash.update(execFileSync("git", ["rev-parse", "HEAD"], {cwd: toolRoot, encoding: "utf8", windowsHide: true})); }
    catch { hash.update("unversioned-build"); }
    return hash.digest("hex");
}
