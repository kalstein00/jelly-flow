import {mkdtempSync, writeFileSync, mkdirSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import {buildProjectReport} from "../../src/report/project";

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
