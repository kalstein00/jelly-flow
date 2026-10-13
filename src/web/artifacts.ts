import {readFileSync, writeFileSync} from "fs";
import path from "path";
import {digest} from "../report/identity";
import type {ReportInput, ReportModel} from "../report/report";

interface Bundle {input: ReportInput; model: ReportModel; html: string}
const names = ["input.json", "model.json", "report.html"] as const;

export function writeArtifacts(directory: string, result: Bundle): "completed" | "partial" {
    const status = result.input.runs.every(run => run.status === "completed") ? "completed" : "partial";
    const contents = [JSON.stringify(result.input), JSON.stringify(result.model), result.html];
    names.forEach((name, i) => writeFileSync(path.join(directory, name), contents[i]));
    writeFileSync(path.join(directory, "artifacts.json"), JSON.stringify({status, snapshot: result.input.snapshot,
        digests: Object.fromEntries(names.map((name, i) => [name, digest(contents[i])]))}));
    return status;
}

/** Verify historical artifacts against their own snapshot, not today's mutable source. */
export function readArtifacts(directory: string): Bundle & {status: "completed" | "partial"} {
    const manifest = JSON.parse(readFileSync(path.join(directory, "artifacts.json"), "utf8"));
    const contents = names.map(name => readFileSync(path.join(directory, name)));
    if (!names.every((name, i) => digest(contents[i]) === manifest.digests?.[name]))
        throw new Error("Stored analysis artifacts are damaged. Reanalyze this project.");
    const input: ReportInput = JSON.parse(contents[0].toString("utf8"));
    const model: ReportModel = JSON.parse(contents[1].toString("utf8"));
    const status = input.runs.every(run => run.status === "completed") ? "completed" : "partial";
    if (input.snapshot !== manifest.snapshot || model.snapshot !== manifest.snapshot || manifest.status !== status)
        throw new Error("Stored analysis snapshot metadata does not match. Reanalyze this project.");
    return {input, model, html: contents[2].toString("utf8"), status};
}
