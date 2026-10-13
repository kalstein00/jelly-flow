/// <reference lib="dom" />
import {chromium, Browser, Page} from "playwright";
import {existsSync, mkdtempSync, mkdirSync, writeFileSync, unlinkSync} from "fs";
import {tmpdir} from "os";
import path from "path";
import {execFileSync} from "child_process";
import {startWebServer} from "../../src/web/server";

let browser: Browser;
let app: Awaited<ReturnType<typeof startWebServer>>;
let page: Page;
let root: string;
let dataDir: string;

beforeAll(async () => {
    execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--build", "tsconfig-build.json"], {windowsHide: true});
    browser = await chromium.launch({headless: true, executablePath: process.env.REPORT_BROWSER || [
        "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"
    ].find(existsSync)});
}, 30000);

beforeEach(async () => {
    root = mkdtempSync(path.join(tmpdir(), "jelly-web-source-"));
    dataDir = mkdtempSync(path.join(tmpdir(), "jelly-web-data-"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src/main.ts"), 'import {save} from "./save"; export function run(){save()}');
    writeFileSync(path.join(root, "src/save.ts"), "export function save(){}");
    writeFileSync(path.join(root, "src/unused.ts"), "export const unused = 1;");
    app = await startWebServer({dataDir, port: 0});
    page = await browser.newPage({viewport: {width: 1500, height: 960}});
    page.setDefaultTimeout(8000);
    await page.goto(app.url);
});
afterEach(async () => { await page?.close(); await app?.close(); });
afterAll(async () => { await browser?.close(); });

async function register() {
    await page.getByLabel("Project folder", {exact: true}).fill(root);
    await page.getByLabel("Analysis areas (JSON)").fill(JSON.stringify([{name: "app", entries: ["src/main.ts"], roots: ["src"]}]));
    await page.getByRole("button", {name: "Save project", exact: true}).click();
}
async function analyze() {
    await page.getByRole("button", {name: "Analyze", exact: true}).click();
    await page.locator("#jobStatus").filter({hasText: /Completed|Reused/}).waitFor({timeout: 180000});
}

test("register a target, run real analysis and explore its files in the local browser", async () => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await register();
    await analyze();
    const graph = page.frameLocator("#graph");
    await graph.locator("#files").getByRole("button", {name: "src/save.ts", exact: true}).click();
    expect(await graph.locator("#details").innerText()).toContain("Distinct caller files: 1");
    await graph.getByText("Coverage and limitations",{exact:true}).click();
    expect(await graph.locator("#coverage").innerText()).toContain('"unanalyzed": 1');
    await graph.getByLabel("Imports", {exact: true}).check();
    await graph.getByRole("button", {name: "Expand functions", exact: true}).click();
    expect(await graph.locator("#functions").innerText()).toContain("save");
    expect(errors).toEqual([]);
    expect(existsSync(path.join(root, ".jelly-flow"))).toBe(false);
}, 180000);

test("saved projects survive restart and keep separate settings", async () => {
    await register();await analyze();
    const firstName = path.basename(root);
    const second = mkdtempSync(path.join(tmpdir(), "jelly-second-"));
    writeFileSync(path.join(second, "entry.ts"), "export const ready = true;");
    await page.getByRole("button", {name: "＋ Add project"}).click();
    await page.getByLabel("Project folder", {exact: true}).fill(second);
    await page.getByLabel("Analysis areas (JSON)").fill('[{"name":"service","entries":["entry.ts"],"roots":["."]}]');
    await page.getByRole("button", {name: "Save project", exact: true}).click();
    await page.locator("#projects").getByRole("button", {name: path.basename(second), exact: true}).waitFor();
    await app.close();
    app = await startWebServer({dataDir, port: 0});
    await page.goto(app.url);
    await page.locator("#projects").getByRole("button", {name: firstName, exact: true}).click();
    await page.waitForFunction(expected => (document.querySelector("#root") as HTMLInputElement).value === expected, root);
    expect(await page.getByLabel("Project folder", {exact: true}).inputValue()).toBe(root);
    await page.frameLocator("#graph").locator("body[data-layout=network]").waitFor();
    let releaseView!: ()=>void, requestedView!: ()=>void;
    const viewBarrier=new Promise<void>(resolve=>{releaseView=resolve;});
    const viewRequested=new Promise<void>(resolve=>{requestedView=resolve;});
    await page.route("**/results/**/view",async route=>{requestedView();await viewBarrier;await route.continue();});
    await page.locator("#projects").getByRole("button", {name: path.basename(second), exact: true}).click();
    await page.waitForFunction(expected => (document.querySelector("#root") as HTMLInputElement).value === expected, second);
    await analyze();
    await viewRequested;
    try{expect(await page.locator("#graph").isHidden()).toBe(true);}finally{releaseView();}
    await page.frameLocator("#graph").locator("#files").getByRole("button",{name:"entry.ts",exact:true}).waitFor();
    expect(await page.frameLocator("#graph").locator("#files").innerText()).toContain("entry.ts");
}, 360000);

test("suggest areas from a project folder, review them and run the saved configuration", async () => {
    writeFileSync(path.join(root, "package.json"), JSON.stringify({name: "small-ts-app", source: "src/main.ts"}));
    await page.getByLabel("Project folder", {exact: true}).fill(root);
    await page.getByRole("button", {name: "Suggest settings", exact: true}).click();
    await page.locator("#proposal").filter({hasText: "package.json"}).waitFor();
    const areas = JSON.parse(await page.getByLabel("Analysis areas (JSON)").inputValue());
    expect(areas).toEqual([{name: "app", entries: ["src/main.ts"], roots: ["src"]}]);
    expect(await page.locator("#jobStatus").innerText()).not.toContain("Analyzing");
    await page.getByRole("button", {name: "Save project", exact: true}).click();
    await page.getByRole("button", {name: "Analyze", exact: true}).waitFor();
    await analyze();
    expect(await page.frameLocator("#graph").locator("#files").innerText()).toContain("src/save.ts");
}, 180000);

test("workspace suggestions distinguish Electron areas and unresolved worker code", async () => {
    writeFileSync(path.join(root, "package.json"), '{"workspaces":["desktop"]}');
    const desktop = path.join(root, "desktop");
    for (const dir of ["src/main", "src/preload", "src/renderer/src"]) mkdirSync(path.join(desktop, dir), {recursive: true});
    writeFileSync(path.join(desktop, "package.json"), '{"name":"desktop"}');
    writeFileSync(path.join(desktop, "electron.vite.config.ts"), "export default {main:{},preload:{},renderer:{}};");
    writeFileSync(path.join(desktop, "src/main/index.ts"), 'import worker from "./work?modulePath"; new Worker(worker); new Worker("inline code", {eval:true});');
    writeFileSync(path.join(desktop, "src/main/work.ts"), "export const ready=true;");
    writeFileSync(path.join(desktop, "src/preload/index.ts"), "export const api={};");
    writeFileSync(path.join(desktop, "src/renderer/index.html"), '<script type="module" src="/src/main.tsx"></script>');
    writeFileSync(path.join(desktop, "src/renderer/src/main.tsx"), "export const app=1;");
    await page.getByLabel("Project folder", {exact: true}).fill(root);
    await page.getByRole("button", {name: "Suggest settings", exact: true}).click();
    await page.locator("#proposal").filter({hasText: "electron.vite.config"}).waitFor();
    const areas = JSON.parse(await page.getByLabel("Analysis areas (JSON)").inputValue()) as Array<{name:string;entries:string[]}>;
    expect(areas.flatMap(area => area.entries).sort()).toEqual([
        "desktop/src/main/index.ts", "desktop/src/main/work.ts", "desktop/src/preload/index.ts", "desktop/src/renderer/src/main.tsx"
    ]);
    expect(await page.locator("#proposal").innerText()).toContain("Embedded or dynamic worker");
    expect(await page.locator("#proposal").innerText()).toContain("Review");
}, 30000);

test("drag a file node in the free layout and still explore functions and filters", async () => {
    await register(); await analyze();
    const graph = page.frameLocator("#graph");
    await graph.locator("body[data-layout=network]").waitFor();
    await graph.locator("#files").getByRole("button", {name: "src/save.ts", exact: true}).click();
    const node = graph.locator('#scene [role=button][aria-label="src/save.ts"] circle');
    const before = await node.getAttribute("cx");
    const bounds = (await node.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(bounds.x + 90, bounds.y + 40, {steps: 5}); await page.mouse.up();
    expect(await node.getAttribute("cx")).not.toBe(before);
    await graph.getByRole("button", {name: "Expand functions", exact: true}).click();
    expect(await graph.locator("#functions").innerText()).toContain("save");
    await graph.getByLabel("Imports", {exact: true}).check();
    expect(await graph.locator("#scene line[data-kind=import]").count()).toBeGreaterThan(0);
}, 180000);

test("candidate lists distinguish incoming calls and import-only cycles", async () => {
    writeFileSync(path.join(root, "src/save.ts"), 'import {run} from "./main"; export function save(){return run;}');
    await register(); await analyze();
    const graph = page.frameLocator("#graph");
    const candidate = graph.locator("#concentration").getByRole("button", {name: /src\/save.ts/});
    await candidate.click();
    expect(await candidate.innerText()).toContain("in 1 · out 0");
    expect(await graph.locator("#details").innerText()).toContain("src/save.ts");
    const cycles = graph.locator("#cycleList");
    expect(await cycles.innerText()).toContain("Imports");
    expect(await cycles.innerText()).not.toContain("Possible calls");
    await cycles.getByRole("button").first().click();
    expect(await graph.getByLabel("Imports", {exact: true}).isChecked()).toBe(true);
    await graph.getByLabel("Search files or functions").fill("save");
    expect(await graph.locator("#candidateStatus").innerText()).toContain("hidden");
}, 180000);

test("copy review evidence with source locations and recover from clipboard denial", async () => {
    await register(); await analyze();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const graph = page.frameLocator("#graph");
    await graph.locator("#files").getByRole("button", {name: "src/save.ts", exact: true}).click();
    await graph.getByRole("button", {name: "Expand functions", exact: true}).click();
    await graph.locator("#functions").getByRole("button", {name: "save", exact: true}).click();
    await graph.getByRole("button", {name: "Copy review evidence", exact: true}).click();
    await graph.locator("#evidenceStatus").filter({hasText: "Copied"}).waitFor();
    const copied = await graph.locator("body").evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Function: save");
    expect(copied).toContain("src/save.ts:1:");
    expect(copied).toContain("Possible calls");
    expect(copied).toContain("Analyzed:");
    expect(copied).toContain("Snapshot:");
    await graph.locator("body").evaluate(() => Object.defineProperty(navigator, "clipboard", {configurable:true, value:{writeText:async()=>{throw new Error("Denied");}}}));
    await graph.getByRole("button", {name: "Copy review evidence", exact: true}).click();
    await graph.locator("#evidenceStatus").filter({hasText: "Copy unavailable"}).waitFor();
    expect(await graph.getByLabel("Review evidence").inputValue()).toBe(copied.replaceAll("\r\n", "\n"));
}, 180000);

test("reanalyze changed source, preserve exploration, reuse only valid inputs and report a removed selection", async () => {
    await register(); await analyze();
    const graph = page.frameLocator("#graph");
    await graph.locator("#files").getByRole("button", {name: "src/save.ts", exact: true}).click();
    await graph.getByRole("button", {name: "Expand functions", exact: true}).click();
    await graph.getByRole("button", {name: "Zoom in", exact: true}).click();
    const view = await graph.locator("#map").getAttribute("viewBox");
    const firstUrl = await page.locator("#graph").getAttribute("src");
    writeFileSync(path.join(root, "src/save.ts"), "export function save(){return 2;} export function extra(){}");
    await page.getByRole("button", {name: "Analyze", exact: true}).click();
    await page.locator("#jobStatus").filter({hasText: "Analyzing"}).waitFor();
    expect(await page.locator("#graph").getAttribute("src")).toBe(firstUrl);
    expect(await graph.locator("#details").innerText()).toContain("src/save.ts");
    await page.locator("#jobStatus").filter({hasText: "Completed"}).waitFor({timeout:180000});
    await graph.locator("#functions").filter({hasText:"extra"}).waitFor();
    expect(await graph.locator("#map").getAttribute("viewBox")).toBe(view);
    await page.getByRole("button", {name: "Analyze", exact: true}).click();
    await page.locator("#jobStatus").filter({hasText:"Reused"}).waitFor({timeout:180000});
    writeFileSync(path.join(root, "src/main.ts"), "export function run(){}");
    unlinkSync(path.join(root, "src/save.ts"));
    await analyze();
    await graph.locator("#selectionNotice").filter({hasText:"no longer exists"}).waitFor();
    expect(await graph.locator("#files").innerText()).not.toContain("src/save.ts");
}, 600000);

test("first-run partial and failure are explicit and cannot replace another project's screen", async () => {
    writeFileSync(path.join(root, "src/save.ts"), "export function broken(");
    await register();
    await page.getByRole("button", {name:"Analyze",exact:true}).click();
    const projects = await (await page.request.get(app.url + "/api/projects")).json();
    const first = projects[0];
    const duplicate = await page.request.post(`${app.url}/api/projects/${first.id}/analyze`, {data:{}});
    expect(duplicate.ok()).toBe(false);
    await page.getByRole("button", {name:"＋ Add project"}).click();
    await page.getByLabel("Project folder", {exact:true}).fill(root);
    await page.getByLabel("Analysis areas (JSON)").fill('[{"name":"second","entries":["src/unused.ts"],"roots":["src"]}]');
    await page.getByRole("button", {name:"Save project",exact:true}).click();
    await page.locator("#jobStatus").filter({hasText:"Ready to analyze"}).waitFor();
    const deadline=Date.now()+180000;
    let completed;
    do {
        completed=await (await page.request.get(`${app.url}/api/projects/${first.id}`)).json();
        if(completed.attempt.status!=="running")break;
        await new Promise(resolve=>setTimeout(resolve,250));
    } while(Date.now()<deadline);
    expect(completed.attempt).toMatchObject({status:"partial"});
    expect(await page.locator("#jobStatus").innerText()).toBe("Ready to analyze");
    expect(await page.locator("#graph").isHidden()).toBe(true);
    await page.locator("#projects button").first().click();
    await page.locator("#jobStatus").filter({hasText:"Partial analysis"}).waitFor();
    expect(await page.locator("#graph").isHidden()).toBe(true);
    expect(await page.locator("#empty").innerText()).toContain("Partial analysis is available");
    await page.getByRole("button", {name:"Open partial result",exact:true}).click();
    await page.frameLocator("#graph").locator("body[data-layout=network]").waitFor();
    const firstPartial=await page.locator("#graph").getAttribute("src");
    await page.getByRole("button", {name:"Analyze",exact:true}).click();
    await page.locator("#jobStatus").filter({hasText:"Partial analysis"}).waitFor({timeout:180000});
    await page.getByRole("button", {name:"Open partial result",exact:true}).click();
    await page.waitForFunction(previous=>document.querySelector("#graph")?.getAttribute("src")!==previous,firstPartial);
    await page.getByRole("button", {name:"Show previous result",exact:true}).click();
    await page.waitForFunction(previous=>document.querySelector("#graph")?.getAttribute("src")===previous,firstPartial);
    await page.locator("#projects button").nth(1).click();
    await page.locator("#jobStatus").filter({hasText:"Ready to analyze"}).waitFor();
    unlinkSync(path.join(root,"src/unused.ts"));
    await page.getByRole("button", {name:"Analyze",exact:true}).click();
    await page.locator("#jobStatus").filter({hasText:"Analysis failed"}).waitFor({timeout:180000});
    expect(await page.locator("#graph").isHidden()).toBe(true);
    expect(await page.locator("#empty").innerText()).toContain("No successful result");
}, 600000);

test("late suggestion and save responses do not overwrite the newly selected form",async()=>{
    let releaseSuggestion!: ()=>void;
    const suggestionBarrier=new Promise<void>(resolve=>{releaseSuggestion=resolve;});
    let requestedSuggestion!: ()=>void;
    const suggestionRequested=new Promise<void>(resolve=>{requestedSuggestion=resolve;});
    await page.route("**/api/suggest",async route=>{
        const response=await route.fetch();requestedSuggestion();await suggestionBarrier;await route.fulfill({response});
    });
    await page.getByLabel("Project folder",{exact:true}).fill(root);
    await page.getByRole("button",{name:"Suggest settings",exact:true}).click();
    await suggestionRequested;
    await page.getByRole("button",{name:"＋ Add project"}).click();
    await page.getByLabel("Analysis areas (JSON)").fill("[]");
    releaseSuggestion();
    await page.waitForFunction(()=>!(document.querySelector("#suggest") as HTMLButtonElement).disabled);
    expect(await page.getByLabel("Analysis areas (JSON)").inputValue()).toBe("[]");
    expect(await page.locator("#proposal").innerText()).toBe("");
    let releaseSave!: ()=>void;
    const saveBarrier=new Promise<void>(resolve=>{releaseSave=resolve;});
    let requestedSave!: ()=>void;
    const saveRequested=new Promise<void>(resolve=>{requestedSave=resolve;});
    await page.route("**/api/projects",async route=>{
        if(route.request().method()!=="POST"){await route.continue();return;}
        const response=await route.fetch();requestedSave();await saveBarrier;await route.fulfill({response});
    });
    await register();await saveRequested;
    await page.getByRole("button",{name:"＋ Add project"}).click();
    await page.getByLabel("Project folder",{exact:true}).fill("new unsaved target");
    releaseSave();
    await page.locator("#projects button").first().waitFor();
    expect(await page.getByLabel("Project folder",{exact:true}).inputValue()).toBe("new unsaved target");
    expect(await page.locator("#projectName").innerText()).toBe("Add a project");
},30000);

test("keep the previous result on partial analysis and failure, with explicit switching", async () => {
    writeFileSync(path.join(root, "src/worker.ts"), "export function work(){}");
    await page.getByLabel("Project folder", {exact: true}).fill(root);
    await page.getByLabel("Analysis areas (JSON)").fill(JSON.stringify([
        {name:"app",entries:["src/main.ts"],roots:["src"]}, {name:"worker",entries:["src/worker.ts"],roots:["src/worker.ts"]}
    ]));
    await page.getByRole("button", {name:"Save project",exact:true}).click();
    await analyze();
    const previous = await page.locator("#graph").getAttribute("src");
    writeFileSync(path.join(root, "src/worker.ts"), "export function broken(");
    await page.getByRole("button", {name:"Analyze",exact:true}).click();
    await page.locator("#jobStatus").filter({hasText:"Partial analysis"}).waitFor({timeout:180000});
    expect(await page.locator("#graph").getAttribute("src")).toBe(previous);
    expect(await page.locator("#resultActions").innerText()).toContain("previous result");
    await page.getByRole("button", {name:"Open partial result",exact:true}).click();
    const graph=page.frameLocator("#graph");
    await graph.locator("#coverage").filter({hasText:'"status": "partial"'}).waitFor({state:"attached"});
    await graph.locator("#files").getByRole("button", {name:"src/main.ts",exact:true}).click();
    await graph.getByRole("button", {name:"Copy review evidence",exact:true}).click();
    expect(await graph.getByLabel("Review evidence").inputValue()).toContain("Run status: partial");
    await page.getByRole("button", {name:"Show previous result",exact:true}).click();
    await page.waitForFunction(expected=>document.querySelector("#graph")?.getAttribute("src")===expected,previous);
    expect(await page.locator("#graph").getAttribute("src")).toBe(previous);
    unlinkSync(path.join(root, "src/main.ts"));
    await page.getByRole("button", {name:"Analyze",exact:true}).click();
    await page.locator("#jobStatus").filter({hasText:"Analysis failed"}).waitFor({timeout:180000});
    expect(await page.locator("#graph").getAttribute("src")).toBe(previous);
}, 600000);
