import {isAbsolute, relative, sep} from "path";
import {options} from "../options";

/** Inputs and the configured root are resolver-normalized real paths. */
export function isAppSource(file: string): boolean {
    if (!options.appOnly) return true;
    const rel = relative(options.appOnly, file);
    return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep) &&
        !file.split(/[\\/]/).some(part => part.toLowerCase() === "node_modules");
}
