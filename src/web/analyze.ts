import {readFileSync} from "fs";
import path from "path";
import {buildProjectReport} from "../report/project";
import {projectIdentity} from "../report/identity";
import {readArtifacts, writeArtifacts} from "./artifacts";

async function main() {
    const [configFile, directory, previous] = process.argv.slice(2);
    const config = JSON.parse(readFileSync(configFile, "utf8"));
    let snapshot: string | undefined;
    if (previous) {
        snapshot = projectIdentity(config);
        try {
            const cached = readArtifacts(previous);
            if (cached.status === "completed" && cached.input.snapshot === snapshot) {
                process.send?.({reused: path.basename(previous)}); return;
            }
        } catch { /* Missing or damaged artifacts must be regenerated, not reused. */ }
    }
    const result = await buildProjectReport(config, snapshot);
    const status = writeArtifacts(directory, result);
    const message = status === "partial" ? result.model.runs.filter(run => run.status !== "completed")
        .map(run => `${run.area}: ${run.status} — ${JSON.stringify(run.diagnostics)}`).join("\n") : undefined;
    process.send?.({message, result: {status,
        created: result.input.created, snapshot: result.input.snapshot}});
}
main().catch(error => {process.send?.({error: String(error)}); process.exitCode = 1;});
