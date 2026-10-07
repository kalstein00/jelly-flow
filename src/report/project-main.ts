import {readFileSync} from "fs";
import {publishProjectReport} from "./project";

async function main() {
    const [configFile, output] = process.argv.slice(2);
    if (!configFile || !output) throw new Error("Usage: node lib/report/project-main.js <project-config.json> <report.html>");
    const config = JSON.parse(readFileSync(configFile, "utf8").replace(/^\uFEFF/, ""));
    process.stdout.write(JSON.stringify(await publishProjectReport(config, output)) + "\n");
}
main().catch(error => { process.stderr.write(JSON.stringify({status: "failed", error: String(error)}) + "\n"); process.exitCode = 1; });
