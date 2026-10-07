import {createHash} from "crypto";
import {existsSync, lstatSync, readdirSync, readFileSync} from "fs";
import path from "path";
import {execFileSync} from "child_process";
import type {ProjectConfig} from "./project";

export function digest(data: string | Buffer): string { return createHash("sha256").update(data).digest("hex"); }

/** Hash source/config bytes (including dirty files), installed package manifests, and actual analyzer build. */
export function projectIdentity(config: ProjectConfig): string {
    const hash = createHash("sha256").update(JSON.stringify(config)).update(process.version);
    const walk = (root: string, relative: string, mode: "project" | "tool" | "dependencies") => {
        const absolute = path.join(root, relative);
        if (!existsSync(absolute)) { hash.update("missing:" + absolute); return; }
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink()) {
            // Do not silently reuse an identity that omitted linked source/dependencies.
            throw new Error("Snapshot identity does not support symlink: " + absolute);
        }
        if (stat.isDirectory()) {
            const name = path.basename(absolute);
            if ([".git", ".jelly-flow", "tmp", "coverage", "dist", "out", "build"].includes(name)) return;
            const next = name === "node_modules" ? "dependencies" : mode;
            for (const entry of readdirSync(absolute).sort()) walk(root, path.join(relative, entry), next);
        } else if (mode === "dependencies" ? /(^|[\\/])(package\.json|\.package-lock\.json)$/.test(relative) :
            mode === "tool" || /\.(?:[cm]?[jt]sx?|json|ya?ml|css|html)$/.test(relative)) {
            hash.update(mode + ":" + relative.replaceAll("\\", "/")).update(readFileSync(absolute));
        }
    };
    walk(path.resolve(config.root), "", "project");
    const toolRoot = path.resolve(__dirname, "../..");
    for (const target of ["lib", "resources", "package-lock.json"]) walk(toolRoot, target, "tool");
    try { hash.update(execFileSync("git", ["rev-parse", "HEAD"], {cwd: toolRoot, encoding: "utf8", windowsHide: true})); }
    catch { hash.update("unversioned-build"); }
    return hash.digest("hex");
}
