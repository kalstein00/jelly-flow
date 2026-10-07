import {ReportInput} from "../../src/report/report";

export function reportFixture(): ReportInput {
    return {version: 1, snapshot: "fixture", created: "2026-10-08", selection: "all",
        inventory: [{path: "app/a.ts", areas: ["app"]}, {path: "shared/b.ts", areas: ["app"]}],
        runs: [{area: "app", status: "completed", diagnostics: {warnings: 0}, graph: {
            files: ["app/a.ts", "shared/b.ts"], functions: {0: "0:1:1:3:2", 1: "1:1:1:3:2"},
            functionMetadata: {0: {kind: "function", name: "run"}, 1: {kind: "function", name: "save"}},
            calls: {0: "0:2:1:2:7"}, fun2fun: [[0, 1]], call2fun: [[0, 1]]
        }}]};
}
