import {mkdtempSync, writeFileSync, mkdirSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import {execFileSync} from "child_process";
import {buildProjectReport, publishProjectReport} from "../../src/report/project";

beforeAll(() => {
    execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--build", "tsconfig-build.json"],
        {cwd: path.resolve(__dirname, "../.."), windowsHide: true});
}, 30000);

test("project report analyzes entries and retains unvisited app files but excludes tests", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "report-project-"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src/main.ts"), 'import {save} from "./save"; export function run(){save()}');
    writeFileSync(path.join(root, "src/save.ts"), "export function save(){}");
    writeFileSync(path.join(root, "src/unused.ts"), "export const unused = 1");
    writeFileSync(path.join(root, "src/main.test.ts"), "throw 0");
    const result = await buildProjectReport({root, areas: [{name: "app", entries: ["src/main.ts"], roots: ["src"]}]});
    expect(result.model.files.map(f => f.path).sort()).toEqual(["src/main.ts", "src/save.ts", "src/unused.ts"]);
    expect(result.model.files.find(f => f.path === "src/unused.ts")?.status).toBe("unanalyzed");
    expect(result.model.files.find(f => f.path === "src/save.ts")?.callers).toBe(1);
    expect(result.model.edges.find(e => e.kind === "import")).toMatchObject({
        source: "src/main.ts", target: "src/save.ts", count: 1
    });
}, 30000);

test("same input reuses a valid report while dirty source invalidates reuse", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "report-cache-"));
    writeFileSync(path.join(root, "main.ts"), "export function run(){}");
    const output = path.join(root, ".jelly-flow", "report.html");
    const config = {root, areas: [{name: "app", entries: ["main.ts"], roots: ["."]}]};
    expect((await publishProjectReport(config, output)).status).toBe("generated");
    expect((await publishProjectReport(config, output)).status).toBe("reused");
    mkdirSync(path.join(root, "node_modules", "vendor"), {recursive: true});
    writeFileSync(path.join(root, "node_modules", "vendor", "package.json"), '{"name":"vendor","main":"index.js"}');
    writeFileSync(path.join(root, "node_modules", "vendor", "index.js"), "exports.a=1");
    expect((await publishProjectReport(config, output)).status).toBe("generated");
    writeFileSync(path.join(root, "node_modules", "vendor", "index.js"), "exports.a=2");
    expect((await publishProjectReport(config, output)).status).toBe("generated");
    writeFileSync(path.join(root, "main.ts"), "export function changed(){}");
    expect((await publishProjectReport(config, output)).status).toBe("generated");
}, 30000);

test("existing bundler path resources are reported without pretending to execute the worker", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "report-resources-"));
    writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}');
    writeFileSync(path.join(root, "main.ts"), 'import image from "./icon.png?asset"; import worker from "./worker?modulePath"; export function run(){return [image,worker]}');
    writeFileSync(path.join(root, "icon.png"), "fixture");
    writeFileSync(path.join(root, "worker.ts"), "export function worker(){}");
    const result = await buildProjectReport({root, areas: [{name: "app", entries: ["main.ts"], roots: ["."]}]});
    expect(result.model.runs[0].status).toBe("completed");
    expect(result.model.runs[0].diagnostics.resourceImports).toHaveLength(2);
    expect(result.model.files.find(f => f.path === "worker.ts")?.status).toBe("unanalyzed");
}, 30000);
