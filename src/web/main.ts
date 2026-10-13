import path from "path";
import {homedir} from "os";
import {startWebServer} from "./server";

async function main() {
    const app = await startWebServer({dataDir: process.env.JELLY_FLOW_DATA_DIR || path.join(homedir(), ".jelly-flow", "web"),
        port: Number(process.env.JELLY_FLOW_PORT || 0)});
    console.log(`Jelly Flow: ${app.url}`);
    const stop = () => {app.close().then(() => process.exit(0)).catch(() => process.exit(1));};
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
main().catch(error => {console.error(String(error)); process.exitCode = 1;});
