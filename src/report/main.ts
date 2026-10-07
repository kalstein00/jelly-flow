import {readFileSync} from "fs";
import {writeReport} from "./report";

try {
    const [input, output] = process.argv.slice(2);
    if (!input || !output) throw new Error("Usage: node lib/report/main.js <report-input.json> <report.html>");
    const model = writeReport(JSON.parse(readFileSync(input, "utf8").replace(/^\uFEFF/, "")), output);
    process.stdout.write(JSON.stringify({status: "generated", output, files: model.files.length}) + "\n");
} catch (error) {
    process.stderr.write(JSON.stringify({status: "failed", error: String(error)}) + "\n");
    process.exitCode = 1;
}
